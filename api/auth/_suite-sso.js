import crypto from 'node:crypto';
import { Redis } from 'ioredis';
import nodemailer from 'nodemailer';

export const SUITE_ORIGINS = new Set([
    'https://bank-value-benchmark-mvp.vercel.app',
    'https://bank-ma-radar.vercel.app',
    'https://fintechprospector.vercel.app',
    'https://de-novo-whitespace-explorer.vercel.app',
    'https://fdic-suite-landing.vercel.app',
]);

export const CENTRAL_ORIGIN = 'https://bank-value-benchmark-mvp.vercel.app';
export const SESSION_COOKIE = 'fdic_suite_session';
export const OAUTH_COOKIE = 'fdic_suite_oauth';
export const LOGIN_ALERT_EVENT = 'FDIC_SUITE_LOGIN_FIRST_SEEN';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// A user may pause on LinkedIn for MFA, password recovery, or a consent review.
// Keep the state cookie-bound, but allow enough time to finish that real-world
// flow before the one-time Redis record and browser cookie expire.
export const OAUTH_TTL_SECONDS = 60 * 30;
const TICKET_TTL_SECONDS = 60;

const SUITE_APP_NAMES = new Map([
    ['https://bank-value-benchmark-mvp.vercel.app', 'Bank Value Benchmark'],
    ['https://bank-ma-radar.vercel.app', 'Bank M&A Radar'],
    ['https://fintechprospector.vercel.app', 'B2B Fintech Prospector'],
    ['https://de-novo-whitespace-explorer.vercel.app', 'De Novo Explorer'],
    ['https://fdic-suite-landing.vercel.app', 'FDIC Intelligence Suite'],
]);

export function isAllowedSuiteOrigin(origin) {
    if (SUITE_ORIGINS.has(origin)) return true;
    try {
        return ['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
    } catch {
        return false;
    }
}

export function normalizeReturnTo(value, fallback = `${CENTRAL_ORIGIN}/`) {
    let url;
    try {
        url = new URL(value || fallback);
    } catch {
        throw new Error('Invalid suite return URL');
    }

    const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((!isLocal && url.protocol !== 'https:') || (isLocal && !['http:', 'https:'].includes(url.protocol))) {
        throw new Error('Unsupported suite return URL protocol');
    }
    if (!isAllowedSuiteOrigin(url.origin)) {
        throw new Error('Unapproved suite return URL');
    }
    if (url.username || url.password) {
        throw new Error('Credentials are not allowed in suite return URLs');
    }

    url.hash = '';
    return url.toString();
}

export function parseCookies(req) {
    return Object.fromEntries(
        String(req.headers.cookie || '')
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const index = part.indexOf('=');
                const key = index >= 0 ? part.slice(0, index) : part;
                const value = index >= 0 ? part.slice(index + 1) : '';
                return [decodeURIComponent(key), decodeURIComponent(value)];
            }),
    );
}

export function setCookie(res, name, value, maxAge) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const serialized = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
    const existing = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), serialized] : serialized);
}

export function clearCookie(res, name) {
    setCookie(res, name, '', 0);
}

export function oauthCookieName(state) {
    return `${OAUTH_COOKIE}_${state}`;
}

export function createRedis() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) throw new Error('REDIS_URL is not configured');
    return new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: false });
}

export function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

export function constantTimeEqual(left, right) {
    const leftBuffer = Buffer.from(String(left || ''));
    const rightBuffer = Buffer.from(String(right || ''));
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function readSession(req, redis) {
    const sessionId = parseCookies(req)[SESSION_COOKIE];
    if (!sessionId) return null;
    const raw = await redis.get(`suite:sso:session:${sessionId}`);
    if (!raw) return null;
    await redis.expire(`suite:sso:session:${sessionId}`, SESSION_TTL_SECONDS);
    return { sessionId, user: JSON.parse(raw) };
}

export async function createSession(res, redis, user) {
    const sessionId = randomToken();
    await redis.set(`suite:sso:session:${sessionId}`, JSON.stringify(user), 'EX', SESSION_TTL_SECONDS);
    setCookie(res, SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS);
    return sessionId;
}

export function buildSuiteLoginAlert(user, returnTo, now = new Date()) {
    if (!user?.sub) throw new Error('LinkedIn subject is required for login monitoring');

    const destination = new URL(normalizeReturnTo(returnTo));
    const occurredAt = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(occurredAt.getTime())) throw new Error('Invalid login event timestamp');

    return {
        event: 'first_linkedin_login',
        eventId: crypto.createHash('sha256').update(String(user.sub)).digest('hex').slice(0, 16),
        name: String(user.name || 'LinkedIn member').slice(0, 160),
        email: user.email ? String(user.email).slice(0, 320) : null,
        sourceApp: SUITE_APP_NAMES.get(destination.origin) || destination.hostname,
        sourceOrigin: destination.origin,
        occurredAt: occurredAt.toISOString(),
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function buildSuiteLoginEmail(event, env = process.env) {
    const smtpUser = env.SMTP_USER?.trim();
    const senderEmail = env.EMAIL_SENDER?.trim() || smtpUser;
    const adminEmail = env.ADMIN_EMAIL?.trim() || senderEmail;

    if (!env.SMTP_SERVER?.trim() || !smtpUser || !env.SMTP_PASS || !adminEmail) {
        throw new Error('Gmail notification configuration is incomplete');
    }

    const subject = `New FDIC Suite registration: ${event.name}`;
    return {
        from: `FDIC Suite Alerts <${senderEmail}>`,
        to: adminEmail,
        subject,
        text: [
            'A new LinkedIn user registered for the FDIC Intelligence Suite.',
            `Name: ${event.name}`,
            `Email: ${event.email || 'Not provided by LinkedIn'}`,
            `Started from: ${event.sourceApp}`,
            `Time: ${event.occurredAt}`,
        ].join('\n'),
        html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
                <h1 style="color: #2563eb;">New FDIC Suite registration</h1>
                <p>A new LinkedIn user registered for the FDIC Intelligence Suite.</p>
                <p><strong>Name:</strong> ${escapeHtml(event.name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(event.email || 'Not provided by LinkedIn')}</p>
                <p><strong>Started from:</strong> ${escapeHtml(event.sourceApp)}</p>
                <p><strong>Time:</strong> ${escapeHtml(event.occurredAt)}</p>
            </div>
        `,
    };
}

export async function recordFirstSuiteLogin(redis, user, returnTo, options = {}) {
    const event = buildSuiteLoginAlert(user, returnTo, options.now);

    // Preserve the old SMTP system's successful-notification marker so existing
    // users are not announced again during migration.
    if (await redis.exists(`notified:${user.sub}`)) return null;

    const markerKey = `suite:sso:login-alert:${user.sub}`;
    const claimed = await redis.set(
        markerKey,
        event.eventId,
        'NX',
    );
    if (claimed !== 'OK') return null;

    try {
        const env = options.env || process.env;
        const transporter = options.transporter || nodemailer.createTransport({
            host: env.SMTP_SERVER.trim(),
            port: Number.parseInt(env.SMTP_PORT || '587', 10),
            secure: Number.parseInt(env.SMTP_PORT || '587', 10) === 465,
            auth: {
                user: env.SMTP_USER.trim(),
                pass: env.SMTP_PASS,
            },
        });
        const delivery = await transporter.sendMail(buildSuiteLoginEmail(event, env));
        await redis.set(`notified:${user.sub}`, 'true');

        const logger = options.logger || console;
        logger.info(`${LOGIN_ALERT_EVENT} ${JSON.stringify({
            ...event,
            delivery: 'sent',
            messageId: delivery.messageId || null,
        })}`);
        return event;
    } catch (error) {
        // Let a later sign-in retry if Gmail was temporarily unavailable.
        await redis.del(markerKey);
        throw error;
    }
}

export async function createOAuthState(res, redis, payload) {
    const state = randomToken();
    await redis.set(`suite:sso:oauth:${state}`, JSON.stringify(payload), 'EX', OAUTH_TTL_SECONDS);
    // A user can start sign-in from several suite apps or browser tabs. Keep
    // each pending request in its own cookie so a newer flow cannot overwrite
    // the state that an earlier LinkedIn callback still needs to validate.
    setCookie(res, oauthCookieName(state), state, OAUTH_TTL_SECONDS);
    return state;
}

export async function consumeOAuthState(req, res, redis, state) {
    const cookies = parseCookies(req);
    const stateCookieName = oauthCookieName(state);
    // Accept the former shared cookie for any sign-in already in flight while
    // this change rolls out, then clear only the cookie that was consumed.
    const usesLegacyCookie = !cookies[stateCookieName] && Boolean(cookies[OAUTH_COOKIE]);
    const cookieState = cookies[stateCookieName] || cookies[OAUTH_COOKIE];
    if (!constantTimeEqual(cookieState, state)) throw new Error('OAuth state validation failed');
    const raw = await redis.call('GETDEL', `suite:sso:oauth:${state}`);
    clearCookie(res, usesLegacyCookie ? OAUTH_COOKIE : stateCookieName);
    if (!raw) throw new Error('OAuth state is missing, expired, or already used');
    return JSON.parse(raw);
}

export async function createSuiteTicket(redis, user, returnTo) {
    const normalizedReturnTo = normalizeReturnTo(returnTo);
    const audience = new URL(normalizedReturnTo).origin;
    const ticket = randomToken();
    await redis.set(
        `suite:sso:ticket:${ticket}`,
        JSON.stringify({ user, audience }),
        'EX',
        TICKET_TTL_SECONDS,
    );
    const destination = new URL(normalizedReturnTo);
    destination.searchParams.set('sso_ticket', ticket);
    destination.searchParams.set('sso_checked', '1');
    return destination.toString();
}

export async function consumeSuiteTicket(redis, ticket) {
    if (!ticket || typeof ticket !== 'string') return null;
    const raw = await redis.call('GETDEL', `suite:sso:ticket:${ticket}`);
    return raw ? JSON.parse(raw) : null;
}

export function anonymousReturnUrl(returnTo) {
    const destination = new URL(normalizeReturnTo(returnTo));
    destination.searchParams.set('sso_checked', '1');
    destination.searchParams.set('sso_status', 'anonymous');
    return destination.toString();
}

export async function closeRedis(redis) {
    if (redis) await redis.quit().catch(() => redis.disconnect());
}





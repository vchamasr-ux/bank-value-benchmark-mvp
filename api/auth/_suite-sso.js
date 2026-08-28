import crypto from 'node:crypto';
import { Redis } from 'ioredis';

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
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// A user may pause on LinkedIn for MFA, password recovery, or a consent review.
// Keep the state cookie-bound, but allow enough time to finish that real-world
// flow before the one-time Redis record and browser cookie expire.
export const OAUTH_TTL_SECONDS = 60 * 30;
const TICKET_TTL_SECONDS = 60;

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

export async function createOAuthState(res, redis, payload) {
    const state = randomToken();
    await redis.set(`suite:sso:oauth:${state}`, JSON.stringify(payload), 'EX', OAUTH_TTL_SECONDS);
    setCookie(res, OAUTH_COOKIE, state, OAUTH_TTL_SECONDS);
    return state;
}

export async function consumeOAuthState(req, res, redis, state) {
    const cookieState = parseCookies(req)[OAUTH_COOKIE];
    if (!constantTimeEqual(cookieState, state)) throw new Error('OAuth state validation failed');
    const raw = await redis.call('GETDEL', `suite:sso:oauth:${state}`);
    clearCookie(res, OAUTH_COOKIE);
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


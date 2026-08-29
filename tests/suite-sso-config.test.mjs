import test from 'node:test';
import assert from 'node:assert/strict';
import {
    anonymousReturnUrl,
    buildSuiteLoginAlert,
    buildSuiteLoginEmail,
    CENTRAL_ORIGIN,
    consumeOAuthState,
    createOAuthState,
    LOGIN_ALERT_EVENT,
    normalizeReturnTo,
    oauthCookieName,
    OAUTH_TTL_SECONDS,
    recordFirstSuiteLogin,
    SUITE_ORIGINS,
} from '../api/auth/_suite-sso.js';

test('canonical BankValue origin is the central LinkedIn callback host', () => {
    assert.equal(CENTRAL_ORIGIN, 'https://bank-value-benchmark-mvp.vercel.app');
    assert.ok(SUITE_ORIGINS.has(CENTRAL_ORIGIN));
});

test('all production suite origins are accepted', () => {
    for (const origin of SUITE_ORIGINS) {
        assert.equal(new URL(normalizeReturnTo(`${origin}/auth/callback`)).origin, origin);
    }
});

test('unapproved redirect origins are rejected', () => {
    assert.throws(() => normalizeReturnTo('https://attacker.example/callback'), /Unapproved/);
});

test('anonymous handoff is marked and preserves the destination', () => {
    const result = new URL(anonymousReturnUrl('https://fintechprospector.vercel.app/auth/callback'));
    assert.equal(result.origin, 'https://fintechprospector.vercel.app');
    assert.equal(result.searchParams.get('sso_checked'), '1');
    assert.equal(result.searchParams.get('sso_status'), 'anonymous');
});

test('LinkedIn sign-in state survives a realistic MFA or consent pause', () => {
    assert.ok(OAUTH_TTL_SECONDS >= 60 * 30);
});

test('parallel LinkedIn sign-ins keep independent cookie-bound states', async () => {
    const values = new Map();
    const redis = {
        async set(key, value) {
            values.set(key, value);
            return 'OK';
        },
        async call(command, key) {
            assert.equal(command, 'GETDEL');
            const value = values.get(key);
            values.delete(key);
            return value;
        },
    };
    const createResponse = () => {
        const headers = new Map();
        return {
            getHeader(name) {
                return headers.get(name);
            },
            setHeader(name, value) {
                headers.set(name, value);
            },
        };
    };
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    const firstState = await createOAuthState(firstResponse, redis, { returnTo: CENTRAL_ORIGIN });
    const secondState = await createOAuthState(secondResponse, redis, { returnTo: CENTRAL_ORIGIN });
    const cookiePair = (response) => response.getHeader('Set-Cookie').split(';', 1)[0];
    const request = {
        headers: {
            cookie: `${cookiePair(firstResponse)}; ${cookiePair(secondResponse)}`,
        },
    };

    assert.notEqual(firstState, secondState);
    assert.match(cookiePair(firstResponse), new RegExp(`^${oauthCookieName(firstState)}=`));
    assert.match(cookiePair(secondResponse), new RegExp(`^${oauthCookieName(secondState)}=`));
    assert.deepEqual(
        await consumeOAuthState(request, createResponse(), redis, firstState),
        { returnTo: CENTRAL_ORIGIN },
    );
    assert.deepEqual(
        await consumeOAuthState(request, createResponse(), redis, secondState),
        { returnTo: CENTRAL_ORIGIN },
    );
});

test('first LinkedIn login sends one Gmail alert without exposing the raw subject', async () => {
    const values = new Map();
    const deliveries = [];
    const redis = {
        async exists(key) {
            return values.has(key) ? 1 : 0;
        },
        async set(key, value, mode) {
            if (mode === 'NX' && values.has(key)) return null;
            values.set(key, value);
            return 'OK';
        },
        async del(key) {
            values.delete(key);
        },
    };
    const lines = [];
    const user = {
        sub: 'linkedin-member-123',
        name: 'Test Member',
        email: 'member@example.com',
    };
    const options = {
        logger: { info: (line) => lines.push(line) },
        now: new Date('2026-08-28T20:00:00.000Z'),
        env: {
            SMTP_SERVER: 'smtp.gmail.com',
            SMTP_PORT: '587',
            SMTP_USER: 'owner@example.com',
            SMTP_PASS: 'test-only',
            EMAIL_SENDER: 'owner@example.com',
        },
        transporter: {
            async sendMail(message) {
                deliveries.push(message);
                return { messageId: 'gmail-test-message' };
            },
        },
    };

    const first = await recordFirstSuiteLogin(
        redis,
        user,
        'https://fintechprospector.vercel.app/auth/callback',
        options,
    );
    const duplicate = await recordFirstSuiteLogin(
        redis,
        user,
        'https://fintechprospector.vercel.app/auth/callback',
        options,
    );

    assert.equal(first.sourceApp, 'B2B Fintech Prospector');
    assert.equal(first.occurredAt, '2026-08-28T20:00:00.000Z');
    assert.equal(duplicate, null);
    assert.equal(lines.length, 1);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].to, 'owner@example.com');
    assert.match(deliveries[0].subject, /Test Member/);
    assert.match(lines[0], new RegExp(`^${LOGIN_ALERT_EVENT} `));
    assert.equal(lines[0].includes(user.sub), false);
});

test('legacy successful notification suppresses a migration duplicate', async () => {
    const user = { sub: 'previously-notified', name: 'Existing Member' };
    const redis = {
        async exists(key) {
            return key === `notified:${user.sub}` ? 1 : 0;
        },
        async set() {
            throw new Error('new marker must not be written');
        },
    };

    assert.equal(
        await recordFirstSuiteLogin(redis, user, CENTRAL_ORIGIN),
        null,
    );
});

test('login alert builder rejects an invalid monitoring timestamp', () => {
    assert.throws(
        () => buildSuiteLoginAlert(
            { sub: 'member' },
            CENTRAL_ORIGIN,
            'not-a-date',
        ),
        /Invalid login event timestamp/,
    );
});

test('Gmail delivery failure releases the first-login marker for retry', async () => {
    const values = new Map();
    const redis = {
        async exists() {
            return 0;
        },
        async set(key, value, mode) {
            if (mode === 'NX' && values.has(key)) return null;
            values.set(key, value);
            return 'OK';
        },
        async del(key) {
            values.delete(key);
        },
    };

    await assert.rejects(
        recordFirstSuiteLogin(
            redis,
            { sub: 'retry-member', name: 'Retry Member' },
            CENTRAL_ORIGIN,
            {
                env: {
                    SMTP_SERVER: 'smtp.gmail.com',
                    SMTP_USER: 'owner@example.com',
                    SMTP_PASS: 'invalid',
                },
                transporter: {
                    async sendMail() {
                        throw new Error('Gmail unavailable');
                    },
                },
            },
        ),
        /Gmail unavailable/,
    );

    assert.equal(values.has('suite:sso:login-alert:retry-member'), false);
});

test('Gmail email builder rejects incomplete credentials', () => {
    assert.throws(
        () => buildSuiteLoginEmail(
            buildSuiteLoginAlert({ sub: 'member', name: 'Member' }, CENTRAL_ORIGIN),
            {},
        ),
        /configuration is incomplete/,
    );
});





import test from 'node:test';
import assert from 'node:assert/strict';
import {
    anonymousReturnUrl,
    buildSuiteLoginAlert,
    CENTRAL_ORIGIN,
    LOGIN_ALERT_EVENT,
    normalizeReturnTo,
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

test('first LinkedIn login emits one monitor event without exposing the raw subject', async () => {
    const values = new Map();
    const redis = {
        async exists(key) {
            return values.has(key) ? 1 : 0;
        },
        async set(key, value, mode) {
            assert.equal(mode, 'NX');
            if (values.has(key)) return null;
            values.set(key, value);
            return 'OK';
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



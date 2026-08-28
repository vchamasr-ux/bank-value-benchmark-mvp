import test from 'node:test';
import assert from 'node:assert/strict';
import {
    anonymousReturnUrl,
    CENTRAL_ORIGIN,
    normalizeReturnTo,
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

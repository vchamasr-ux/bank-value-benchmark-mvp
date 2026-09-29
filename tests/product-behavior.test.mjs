import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
let calculateKPIs;
let calcCAGR;
let getBankFinancials;
let LandingPage;

before(async () => {
  vite = await createServer({
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
  });
  ({ calculateKPIs, calcCAGR } = await vite.ssrLoadModule('/src/utils/kpiCalculator.js'));
  ({ getBankFinancials } = await vite.ssrLoadModule('/src/services/fdicService.js'));
  ({ default: LandingPage } = await vite.ssrLoadModule('/src/components/layout/LandingPage.jsx'));
});

after(async () => {
  await vite?.close();
});

const validReport = (overrides = {}) => ({
  REPDTE: '20260630', ASSET: '1000000', DEP: '800000', NUMEMP: '100',
  INTINC: '30000', INTEXP: '10000', NONII: '5000', NONIX: '12000',
  LNLSNET: '600000', NETINC: '10000', EQ: '100000', NCLNLS: '6000',
  ...overrides,
});

test('landing page renders the real bank search without prefilled dashboard KPIs', () => {
  const html = renderToStaticMarkup(React.createElement(LandingPage, { onBankSelect() {} }));
  assert.match(html, /Strategic Clarity in/);
  assert.match(html, /id="bank-search-input"/);
  assert.match(html, /Live Data from FDIC/);
  assert.doesNotMatch(html, /Return on Assets|Net Interest Margin|Efficiency Ratio/);
});

test('FDIC financial response produces KPI values from real report fields', () => {
  const result = calculateKPIs(validReport());
  assert.equal(result.reportDate, 'Q2 2026');
  assert.equal(result.netInterestMargin, 4);
  assert.equal(result.returnOnAssets, 2);
  assert.equal(result.efficiencyRatio, 24);
  assert.equal(calculateKPIs(null), null);
});

test('missing or malformed FDIC financial data fails instead of producing dashboard KPIs', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ unexpected: [] }) });
    await assert.rejects(getBankFinancials('12345'), /data/);
    assert.throws(() => calculateKPIs({ REPDTE: '20260630' }), /CRITICAL DATA MISSING/);
    assert.throws(() => calculateKPIs(validReport({ ASSET: 'not-a-number' })), /CRITICAL DATA INVALID/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('FDIC response shape changes are surfaced as validation errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ unexpected: [] }) });
    await assert.rejects(getBankFinancials('12345'), /data/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('CAGR handles growth and non-positive source values', () => {
  assert.equal(calcCAGR(1331, 1000), 10.000000000000009);
  assert.equal(calcCAGR(100, 0), 0);
  assert.equal(calcCAGR(-1, 100), 0);
});

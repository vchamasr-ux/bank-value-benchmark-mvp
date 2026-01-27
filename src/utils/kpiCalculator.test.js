import { describe, it, expect } from 'vitest';
import { calculateKPIs } from './kpiCalculator';

describe('kpiCalculator', () => {
    it('returns null if data is missing', () => {
        expect(calculateKPIs(null)).toBeNull();
        expect(calculateKPIs(undefined)).toBeNull();
    });

    it('calculates KPIs correctly with valid numeric data', () => {
        const input = {
            NONIX: 20000,
            NONII: 5000,
            INTEXP: 10000,
            INTINC: 50000,
            ASSET: 1000000,
            LNLSNET: 800000,
            NUMEMP: 100
        };

        const result = calculateKPIs(input);

        // 1. Efficiency Ratio: 20000 / ( (50000 - 10000) + 5000 ) = 20000 / 45000 = 44.44%
        expect(result.efficiencyRatio).toBe('44.44');

        // 2. Cost of Funds: 10000 / 1000000 = 1.00%
        expect(result.costOfFunds).toBe('1.00');

        // 3. Non-Interest Income %: 5000 / 45000 = 11.11%
        expect(result.nonInterestIncomePercent).toBe('11.11');

        // 4. Yield on Loans: 50000 / 800000 = 6.25%
        expect(result.yieldOnLoans).toBe('6.25');

        // 5. Net Interest Margin: (50000 - 10000) / 1000000 = 4.00%
        expect(result.netInterestMargin).toBe('4.00');

        // 6. Assets per Employee: (1000000 * 1000) / 100 = 10,000,000
        expect(result.assetsPerEmployee).toBe('10000000');
    });

    it('handles zero values gracefully to avoid Infinity/NaN where possible', () => {
        const input = {
            NONIX: 0,
            NONII: 0,
            INTEXP: 0,
            INTINC: 0,
            ASSET: 0,
            LNLSNET: 0,
            NUMEMP: 0
        };

        const result = calculateKPIs(input);

        expect(result.efficiencyRatio).toBe('0.00');
        expect(result.costOfFunds).toBe('0.00');
        expect(result.nonInterestIncomePercent).toBe('0.00');
        expect(result.yieldOnLoans).toBe('0.00');
        expect(result.netInterestMargin).toBe('0.00');
        expect(result.assetsPerEmployee).toBe('0');
    });

    it('handles string inputs from API correctly', () => {
        const input = {
            NONIX: "20000",
            NONII: "5000",
            INTEXP: "10000",
            INTINC: "50000",
            ASSET: "1000000",
            LNLSNET: "800000",
            NUMEMP: "100"
        };

        const result = calculateKPIs(input);
        expect(result.efficiencyRatio).toBe('44.44');
    });

    it('uses EINTEXP if INTEXP is missing', () => {
        const input = {
            NONIX: 20000,
            NONII: 5000,
            INTEXP: null, // Missing
            EINTEXP: 10000, // Fallback
            INTINC: 50000,
            ASSET: 1000000,
        };

        const result = calculateKPIs(input);
        // Cost of Funds: 10000 / 1000000 = 1.00%
        expect(result.costOfFunds).toBe('1.00');
    });
});

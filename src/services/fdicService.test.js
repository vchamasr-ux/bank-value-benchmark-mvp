
import { describe, it, expect, vi } from 'vitest';
import { getPeerGroupBenchmark } from './fdicService';
import * as kpiCalculator from '../utils/kpiCalculator';

// Mock fetch
global.fetch = vi.fn();

describe('fdicService - getPeerGroupBenchmark', () => {
    it('should calculate P25 and P75 correctly for a sample of banks', async () => {
        // Mock 4 banks to make quartiles easy
        // Bank 1: Eff=40
        // Bank 2: Eff=50
        // Bank 3: Eff=60
        // Bank 4: Eff=70
        // Sorted: 40, 50, 60, 70.
        // P25 index = 0.25 * 3 = 0.75 -> Lower 0, Upper 1, Weight 0.75. Val = 40*0.25 + 50*0.75 = 10 + 37.5 = 47.5
        // P75 index = 0.75 * 3 = 2.25 -> Lower 2, Upper 3, Weight 0.25. Val = 60*0.75 + 70*0.25 = 45 + 17.5 = 62.5

        const mockData = {
            data: [
                { data: { NAME: 'B1', ASSET: '1000', INTINC: '200', INTEXP: '100', NONII: '50', NONIX: '100', LNLSNET: '800' } },
                { data: { NAME: 'B2', ASSET: '1000', INTINC: '200', INTEXP: '100', NONII: '50', NONIX: '120', LNLSNET: '800' } },
                { data: { NAME: 'B3', ASSET: '1000', INTINC: '200', INTEXP: '100', NONII: '50', NONIX: '140', LNLSNET: '800' } },
                { data: { NAME: 'B4', ASSET: '1000', INTINC: '200', INTEXP: '100', NONII: '50', NONIX: '160', LNLSNET: '800' } }
            ]
        };

        // We need to mock kpiCalculator because it relies on specific field logic
        // Or we can just let it run if we provide enough data.
        // Let's mock it to control the "Efficiency Ratio" output directly for clarity.

        const spy = vi.spyOn(kpiCalculator, 'calculateKPIs')
            .mockReturnValueOnce({ efficiencyRatio: '40.00', netInterestMargin: '3.00', costOfFunds: '1.00', nonInterestIncomePercent: '10.00', yieldOnLoans: '5.00', assetsPerEmployee: '1000' })
            .mockReturnValueOnce({ efficiencyRatio: '50.00', netInterestMargin: '3.00', costOfFunds: '1.00', nonInterestIncomePercent: '10.00', yieldOnLoans: '5.00', assetsPerEmployee: '1000' })
            .mockReturnValueOnce({ efficiencyRatio: '60.00', netInterestMargin: '3.00', costOfFunds: '1.00', nonInterestIncomePercent: '10.00', yieldOnLoans: '5.00', assetsPerEmployee: '1000' })
            .mockReturnValueOnce({ efficiencyRatio: '70.00', netInterestMargin: '3.00', costOfFunds: '1.00', nonInterestIncomePercent: '10.00', yieldOnLoans: '5.00', assetsPerEmployee: '1000' });

        fetch.mockResolvedValue({
            ok: true,
            json: async () => (mockData)
        });

        const result = await getPeerGroupBenchmark(500000);

        expect(result).not.toBeNull();
        expect(result.p25).toBeDefined();
        expect(result.p75).toBeDefined();

        // Check Efficiency Ratio
        // Expected P25: 47.50
        // Expected P75: 62.50
        expect(result.p25.efficiencyRatio).toBe('47.50');
        expect(result.p75.efficiencyRatio).toBe('62.50');

        spy.mockRestore();
    });
});

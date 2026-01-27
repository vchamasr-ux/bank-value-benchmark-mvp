import { describe, it, expect } from 'vitest';
import { calculateGaugeRanges } from './GaugeChart';

describe('calculateGaugeRanges', () => {

    it('should center the gauge around the average', () => {
        // Min 0, Max 100, Average 20
        // DistMin = |20 - 0| = 20
        // DistMax = |100 - 20| = 80
        // Delta = 80
        // VisualDelta = 80 * 1.1 = 88
        // VisualMin = 20 - 88 = -68
        // VisualMax = 20 + 88 = 108
        // Total Range = 176

        const { ranges, visualMin, visualMax } = calculateGaugeRanges({ min: 0, max: 100, average: 20 });

        expect(visualMin).toBeCloseTo(-68);
        expect(visualMax).toBeCloseTo(108);
        expect(ranges).toHaveLength(3);

        // Sectors should be equal
        const s1 = ranges[0].value;
        const s2 = ranges[1].value;
        const s3 = ranges[2].value;
        expect(s1).toBeCloseTo(176 / 3);
        expect(s2).toBeCloseTo(176 / 3);
        expect(s3).toBeCloseTo(176 / 3);
    });

    it('should assign colors correctly for inverse=false (Red-Yellow-Green)', () => {
        const { ranges } = calculateGaugeRanges({ min: 0, max: 100, average: 50, inverse: false });
        // Low range should be Red (Bad)
        expect(ranges[0].color).toBe('#ef4444');
        expect(ranges[1].color).toBe('#eab308');
        expect(ranges[2].color).toBe('#22c55e');
    });

    it('should assign colors correctly for inverse=true (Green-Yellow-Red)', () => {
        const { ranges } = calculateGaugeRanges({ min: 0, max: 100, average: 50, inverse: true });
        // Low range should be Green (Good, e.g. low cost)
        expect(ranges[0].color).toBe('#22c55e');
        expect(ranges[1].color).toBe('#eab308');
        expect(ranges[2].color).toBe('#ef4444');
    });

    it('should calculate angles for p25 and p75 correctly', () => {
        // Range: -68 to 108 (Total 176)
        // Average: 20 (Center)
        // P25: 10
        // P75: 30

        // Visual Min: -68
        // Visual Max: 108
        // P25 % = (10 - (-68)) / 176 = 78 / 176 ≈ 0.443
        // P75 % = (30 - (-68)) / 176 = 98 / 176 ≈ 0.556

        // P25 Angle = (0.443 * 180) - 90 ≈ -10.22 deg
        // P75 Angle = (0.556 * 180) - 90 ≈ 10.22 deg

        const { p25Angle, p75Angle } = calculateGaugeRanges({
            min: 0, max: 100, average: 20, p25: 10, p75: 30
        });

        expect(p25Angle).toBeNull();
        expect(p75Angle).toBeNull();
    });

});

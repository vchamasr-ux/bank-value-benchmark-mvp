import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FinancialDashboard from '../components/FinancialDashboard';
import React from 'react';

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock Recharts ResponsiveContainer to just render children (avoids width=0 issues)
vi.mock('recharts', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        ResponsiveContainer: ({ children }) => <div className="recharts-responsive-container">{children}</div>,
    };
});

describe('FinancialDashboard', () => {
    const mockFinancials = {
        efficiencyRatio: '55.00',
        costOfFunds: '2.50',
        nonInterestIncomePercent: '20.00',
        yieldOnLoans: '6.00',
        assetsPerEmployee: '10500000' // $10.5M
    };

    it('renders nothing when no financials provided', () => {
        const { container } = render(<FinancialDashboard financials={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the scorecard title', () => {
        render(<FinancialDashboard financials={mockFinancials} />);
        expect(screen.getByText('Financial Health Scorecard')).toBeInTheDocument();
    });

    it('renders all 5 gauges with correct labels', () => {
        render(<FinancialDashboard financials={mockFinancials} />);

        // Check for Labels
        expect(screen.getByText('Efficiency Ratio')).toBeInTheDocument();
        expect(screen.getByText('Cost of Funds')).toBeInTheDocument();
        expect(screen.getByText('Non-Interest Income')).toBeInTheDocument();
        expect(screen.getByText('Yield on Loans')).toBeInTheDocument();
        expect(screen.getByText('Assets / Employee ($M)')).toBeInTheDocument();
    });

    it('displays correct values in the gauges', () => {
        render(<FinancialDashboard financials={mockFinancials} />);

        // Check for Values
        // Note: parseFloat() in component strips trailing zeros (e.g. 55.00 -> 55)
        expect(screen.getByText('55%')).toBeInTheDocument(); // Eff Ratio
        expect(screen.getByText('2.5%')).toBeInTheDocument();  // Cost of Funds
        expect(screen.getByText('20%')).toBeInTheDocument(); // Non Int %
        expect(screen.getByText('6%')).toBeInTheDocument();  // Yield
        expect(screen.getByText('10.5M')).toBeInTheDocument();  // Assets/Emp (converted to M)
    });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OperationalDashboard from './OperationalDashboard';

// Mock Recharts library itself slightly to avoid complex SVG issues in JSDOM,
// but ALLOW children to render so we can test integration with GaugeChart props/text.
vi.mock('recharts', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        ResponsiveContainer: ({ children }) => <div className="recharts-responsive-container" style={{ width: '100%', height: '100px' }}>{children}</div>,
    };
});

describe('OperationalDashboard Integration', () => {
    it('renders the dashboard title', () => {
        render(<OperationalDashboard />);
        expect(screen.getByText('Operational Efficiency')).toBeInTheDocument();
    });

    it('renders the locked overlay with correct text', () => {
        render(<OperationalDashboard />);
        expect(screen.getByText('Unlock Your Full Scorecard')).toBeInTheDocument();
        expect(screen.getByText(/Enter your operational data/i)).toBeInTheDocument();
    });

    it('renders all 5 input fields', () => {
        render(<OperationalDashboard />);
        expect(screen.getByPlaceholderText('e.g. 60')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. 25')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. 12')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. 52')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. 50')).toBeInTheDocument();
    });

    it('allows typing into input fields', () => {
        render(<OperationalDashboard />);
        const input = screen.getByPlaceholderText('e.g. 60');
        fireEvent.change(input, { target: { value: '75' } });
        expect(input.value).toBe('75');
    });

    it('renders the "Compare My Bank" button', () => {
        render(<OperationalDashboard />);
        expect(screen.getByText('Compare My Bank')).toBeInTheDocument();
    });

    it('renders the REAL GaugeCharts with benchmark seed data', () => {
        render(<OperationalDashboard />);

        // We expect the text labels from the real GaugeChart component to be present.
        expect(screen.getByText('Digital Adoption')).toBeInTheDocument();
        expect(screen.getByText('Digital Acct Opening')).toBeInTheDocument();
        expect(screen.getByText('Vendor Spend %')).toBeInTheDocument();
        expect(screen.getByText('Avg Age Customer')).toBeInTheDocument();
        expect(screen.getByText('NPS')).toBeInTheDocument();

        // We verify that the "Value" passed to GaugeChart is actually rendered.
        // GaugeChart.jsx renders `<div>{value}%</div>`
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('12%')).toBeInTheDocument();
        expect(screen.getByText('52%')).toBeInTheDocument();

        // Verify mock is GONE
        const mockTestIds = screen.queryAllByTestId('gauge-chart');
        expect(mockTestIds).toHaveLength(0);
    });

    it('unlocks the dashboard and displays user data when form is submitted', async () => {
        render(<OperationalDashboard />);

        // Fill out the form with known "User" values differnt from seed
        // Seed: Adoption=60. Let's toggle to 80.
        const inputAdoption = screen.getByPlaceholderText('e.g. 60');
        fireEvent.change(inputAdoption, { target: { value: '80' } });

        // Click Unlock
        const button = screen.getByText('Compare My Bank');
        fireEvent.click(button);

        // Verify Overlay is GONE
        await waitFor(() => {
            expect(screen.queryByText('Unlock Your Full Scorecard')).not.toBeInTheDocument();
        });

        // Verify Gauges now show User Data (80%)
        // We use waitFor because re-render might be async
        await waitFor(() => {
            expect(screen.getByText('80%')).toBeInTheDocument();
        });

        // Verify they also show the "Avg: 60%" (benchmark) which GaugeChart renders as average prop
        // GaugeChart renders: <div>Avg: {average}%</div>
        expect(screen.getByText('Avg: 60')).toBeInTheDocument();
    });
});

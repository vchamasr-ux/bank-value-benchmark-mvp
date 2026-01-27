import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';
import * as fdicService from '../services/fdicService';

// Mock Service
vi.mock('../services/fdicService', () => ({
    getBankFinancials: vi.fn(),
    searchBank: vi.fn()
}));

// Mock Child Components
vi.mock('../components/BankSearch', () => ({
    default: ({ onBankSelect }) => (
        <button onClick={() => onBankSelect({ CERT: '12345', NAME: 'Test Bank', CITY: 'Test City', STNAME: 'TS' })}>
            Select Test Bank
        </button>
    )
}));

vi.mock('../components/FinancialDashboard', () => ({
    default: ({ financials }) => (
        <div>
            <h1>Financial Health Scorecard</h1>
            <p>Efficiency Ratio: {financials.efficiencyRatio}%</p>
        </div>
    )
}));

const mockFinancialData = {
    REPDTE: '20231231',
    ASSET: 1000000,
    NUMEMP: 10,
    INTINC: 50000,
    INTEXP: 10000,
    NONII: 5000,
    NONIX: 20000,
    LNLSNET: 800000
};

describe('App Data Wiring Simplified', () => {
    it('fetches data and passes it to dashboard', async () => {
        fdicService.getBankFinancials.mockResolvedValue(mockFinancialData);

        render(<App />);

        // Click search result
        fireEvent.click(screen.getByText('Select Test Bank'));

        // Check loading
        expect(screen.getByText(/Loading Financial Data/i)).toBeInTheDocument();

        // Wait for dashboard to receive data
        await waitFor(() => {
            expect(screen.getByText('Financial Health Scorecard')).toBeInTheDocument();
            // Verify calculation happened
            // (20000 / 45000) * 100 = 44.44
            expect(screen.getByText(/Efficiency Ratio: 44.44%/i)).toBeInTheDocument();
        });
    });
});

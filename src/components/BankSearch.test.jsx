import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BankSearch from './BankSearch';
import * as fdicService from '../services/fdicService';

// Mock the service
vi.mock('../services/fdicService', () => ({
    searchBank: vi.fn(),
}));

describe('BankSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders input and search button', () => {
        render(<BankSearch onBankSelect={vi.fn()} />);
        expect(screen.getByPlaceholderText('Enter bank name...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    it('allows user to type bank name', () => {
        render(<BankSearch onBankSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Enter bank name...');
        fireEvent.change(input, { target: { value: 'Chase' } });
        expect(input.value).toBe('Chase');
    });

    it('shows loading state during search', async () => {
        // Mock a delayed response
        fdicService.searchBank.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));

        render(<BankSearch onBankSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Enter bank name...');
        fireEvent.change(input, { target: { value: 'Chase' } });

        const button = screen.getByRole('button', { name: /search/i });
        fireEvent.click(button);

        // Should show 'Searching...'
        expect(screen.getByText('Searching...')).toBeInTheDocument();
        expect(button).toBeDisabled();

        await waitFor(() => {
            expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
        });
    });

    it('displays error alert when search fails', async () => {
        fdicService.searchBank.mockRejectedValue(new Error('API Down'));

        render(<BankSearch onBankSelect={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Enter bank name...'), { target: { value: 'Fail' } });
        fireEvent.click(screen.getByRole('button', { name: /search/i }));

        await waitFor(() => {
            // Check for the new Alert UI structure
            expect(screen.getByRole('alert')).toBeInTheDocument();
            // The component explicitly sets: "Failed to fetch banks. Please try again."
            // We do NOT check for 'API Down' because the component msg is generic.
            expect(screen.getByText('Failed to fetch banks. Please try again.')).toBeInTheDocument();
        });
    });

    it('displays results when search succeeds', async () => {
        const mockBanks = [{ CERT: '123', NAME: 'Test Bank', CITY: 'Test City', STNAME: 'TS' }];
        fdicService.searchBank.mockResolvedValue(mockBanks);

        const onSelect = vi.fn();
        render(<BankSearch onBankSelect={onSelect} />);

        fireEvent.change(screen.getByPlaceholderText('Enter bank name...'), { target: { value: 'Test' } });
        fireEvent.click(screen.getByRole('button', { name: /search/i }));

        await waitFor(() => {
            expect(screen.getByText('Test Bank')).toBeInTheDocument();
        });

        // Click result
        fireEvent.click(screen.getByText('Test Bank'));
        expect(onSelect).toHaveBeenCalledWith(mockBanks[0]);
    });
});

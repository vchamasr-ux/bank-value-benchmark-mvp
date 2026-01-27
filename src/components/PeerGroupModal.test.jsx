import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PeerGroupModal from './PeerGroupModal';

describe('PeerGroupModal', () => {
    const mockBanks = [
        { name: 'Bank A', city: 'City A', state: 'SA', asset: 150000000 },
        { name: 'Bank B', city: 'City B', state: 'SB', asset: 250000000 },
    ];

    it('should not render when isOpen is false', () => {
        render(<PeerGroupModal isOpen={false} onClose={vi.fn()} title="Test Group" banks={[]} />);
        expect(screen.queryByText('Test Group')).toBeNull();
    });

    it('should render correct title and bank list when isOpen is true', () => {
        render(<PeerGroupModal isOpen={true} onClose={vi.fn()} title="Test Peer Group" banks={mockBanks} />);

        expect(screen.getByText('Test Peer Group')).toBeDefined();
        expect(screen.getByText('Bank A')).toBeDefined();
        expect(screen.getByText('City A, SA')).toBeDefined();
        // 150M -> 0.2B in logic? No: (150,000,000 / 1,000,000) = 150. Wait, logic is (asset / 1000000).toFixed(1) + 'B'.
        // Asset in mock is 150,000,000.  150M / 1M = 150.  150.0B. 
        // Let's check the component logic again: ${(bank.asset / 1000000).toFixed(1)}B
        // Wait, FDIC asset is in THOUSANDS usually? Let's check fdicService. 
        // fdicService: "Class 1: < $100M (100,000)". So FDIC ASSET unit is Thousands.
        // So 150,000,000 (asset value in mock) would be 150,000,000 * 1000 = 150 Billion?
        // If the mock `asset` value is raw from FDIC (thousands), then logic `bank.asset / 1000000` converts Thousands -> Billions.
        // Example: 1,000,000 (1 Billion in thousands) / 1,000,000 = 1.0B. Correct.
        // My mock value 150000000 (150 Million Thousands -> 150 Billion).
        // 150000000 / 1000000 = 150.0B.

        expect(screen.getByText('$150.0B')).toBeDefined();
        expect(screen.getByText('Bank B')).toBeDefined();
        expect(screen.getByText('$250.0B')).toBeDefined();
    });

    it('should call onClose when close button is clicked', () => {
        const onCloseMock = vi.fn();
        render(<PeerGroupModal isOpen={true} onClose={onCloseMock} title="Test Group" banks={mockBanks} />);

        const closeButton = screen.getByText('Close');
        fireEvent.click(closeButton);
        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should display empty message when no banks provided', () => {
        render(<PeerGroupModal isOpen={true} onClose={vi.fn()} title="Test Group" banks={[]} />);
        expect(screen.getByText('No peer bank details available.')).toBeDefined();
    });
});

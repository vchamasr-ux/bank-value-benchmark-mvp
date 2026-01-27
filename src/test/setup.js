import "@testing-library/jest-dom";
import { vi } from 'vitest';

// ResizeObserver polyfill for Recharts
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

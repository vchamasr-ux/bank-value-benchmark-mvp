import { useState, useEffect } from 'react';

/**
 * Shared hook that manages the Gemini rate-limit retry countdown pattern.
 *
 * @param {Function} onRetry - Callback to fire when the countdown reaches zero.
 * @returns {{ retryCountdown, retryCount, setRetryFromError, resetRetry }}
 *
 * Usage:
 *   const { retryCountdown, retryCount, setRetryFromError, resetRetry } = useRetryCountdown(generateSummary);
 *
 *   // When a RATE_LIMIT error occurs:
 *   setRetryFromError(errorMessage);    // parses "retry in Xs" or defaults to 60s
 *
 *   // When the request succeeds:
 *   resetRetry();
 */
const useRetryCountdown = (onRetry) => {
    const [retryCountdown, setRetryCountdown] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let interval;
        if (retryCountdown !== null && retryCountdown > 0) {
            interval = setInterval(() => {
                setRetryCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setRetryCount(prevCount => prevCount + 1);
                        onRetry();
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [retryCountdown]);

    /**
     * Parse an error message for "retry in Xs", then start the countdown.
     * Falls back to 60s if no specific time is found.
     */
    const setRetryFromError = (errorMsg) => {
        const match = errorMsg && errorMsg.match(/retry in (\d+\.?\d*)s/);
        const seconds = match ? Math.ceil(parseFloat(match[1])) : 60;
        setRetryCountdown(seconds);
    };

    const resetRetry = () => {
        setRetryCount(0);
        setRetryCountdown(null);
    };

    return { retryCountdown, retryCount, setRetryFromError, resetRetry };
};

export default useRetryCountdown;

module.exports = {
    ci: {
        collect: {
            // Tells Lighthouse to start a server from this directory
            staticDistDir: './dist',
            // How many times to run the audit (3 is standard for averaging out variance)
            numberOfRuns: 3,
        },
        assert: {
            preset: 'lighthouse:no-pwa',
            assertions: {
                // Enforce budgets. Warn for performance below 80, fail for others below 90.
                'categories:performance': ['warn', { minScore: 0.8 }],
                'categories:accessibility': ['error', { minScore: 0.9 }],
                'categories:best-practices': ['error', { minScore: 0.9 }],
                'categories:seo': ['error', { minScore: 0.9 }],
            }
        },
        upload: {
            // Upload results temporarily to the public lhci server to view HTML reports
            target: 'temporary-public-storage',
        },
    },
};

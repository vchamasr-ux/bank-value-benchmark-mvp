module.exports = {
    ci: {
        collect: {
            // Tells Lighthouse to start a server from the production build
            staticDistDir: './dist',
            // Only audit the main entry point to avoid failing on google verification files
            url: ['http://localhost/index.html'],
            // 2 runs is sufficient for a PR gate (3 is slower and rarely needed)
            numberOfRuns: 2,
        },
        assert: {
            preset: 'lighthouse:no-pwa',
            assertions: {
                // Performance: warn only — varies by runner hardware, not a hard gate
                'categories:performance': ['warn', { minScore: 0.7 }],
                // Accessibility: error below 0.85 (strict but realistic)
                'categories:accessibility': ['error', { minScore: 0.85 }],
                // Best practices: warn — some third-party scripts lower this
                'categories:best-practices': ['warn', { minScore: 0.85 }],
                // SEO: warn — dynamic app content may affect crawlability
                'categories:seo': ['warn', { minScore: 0.85 }],
            }
        },
        upload: {
            // Upload results to temporary public storage to view HTML reports
            target: 'temporary-public-storage',
        },
    },
};

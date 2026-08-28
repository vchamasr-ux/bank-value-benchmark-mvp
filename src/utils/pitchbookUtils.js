import { formatAssets } from './formatUtils';

export const extractInsightTopic = (bullet) => {
    const topics = [
        { match: /efficiency ratio|efficiency/i, label: 'Cost Efficiency' },
        { match: /return on assets|\broa\b/i, label: 'Return on Assets' },
        { match: /return on equity|\broe\b/i, label: 'Return on Equity' },
        { match: /net interest margin|\bnim\b/i, label: 'Net Interest Margin' },
        { match: /asset growth/i, label: 'Asset Growth' },
        { match: /non-performing|\bnpl\b/i, label: 'Loan Quality' },
        { match: /capital/i, label: 'Capital Adequacy' },
        { match: /deposit/i, label: 'Deposit Base' },
        { match: /loan/i, label: 'Loan Portfolio' },
    ];
    for (const { match, label } of topics) {
        if (match.test(bullet)) return label;
    }
    return bullet.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(' ') || 'Key Finding';
};

export const parseAiBullets = (aiSummaryHtml, selectedBank, financials, getBenchmark) => {
    let bullets = [];
    if (aiSummaryHtml) {
        // Extract bullet points from the AI markdown summary
        const lines = aiSummaryHtml.split('\n');
        bullets = lines
            .filter(line => line.trim().startsWith('* ') || line.trim().startsWith('- '))
            .map(line => line.replace(/^[*-\s]+/, '').trim().replace(/\*\*/g, ''))
            .slice(0, 3);

        // Fallback if the AI didn't use lists
        if (bullets.length === 0) {
            bullets = lines.filter(l => l.length > 50).slice(0, 3).map(l => l.replace(/\*\*/g, ''));
        }
    }

    // Final fallback if nothing found
    if (bullets.length === 0 && financials && financials.raw) {
        bullets = [
            `${selectedBank?.NAME || 'The bank'} holds ${formatAssets(financials.raw.ASSET)} in total assets.`,
            `The bank operates with an Efficiency Ratio of ${parseFloat(financials.efficiencyRatio).toFixed(1)}% compared to the peer average of ${getBenchmark('efficiencyRatio').toFixed(1)}%.`,
            `Return on Average Assets (ROA) is tracking at ${parseFloat(financials.returnOnAssets).toFixed(2)}% against a benchmark of ${getBenchmark('returnOnAssets').toFixed(2)}%.`
        ];
    }
    return bullets;
};

export const matchBulletToMetric = (bullet, financials, getBenchmark) => {
    if (!financials) return null;
    const text = bullet.toLowerCase();

    if (text.includes('efficiency ratio') || text.includes('efficiency')) {
        return {
            metric: 'Efficiency Ratio',
            value: parseFloat(financials.efficiencyRatio),
            average: getBenchmark('efficiencyRatio'),
            min: 30, max: 90, inverse: true, suffix: '%'
        };
    }
    if (text.includes('return on assets') || text.includes('roa ')) {
        return {
            metric: 'Return on Assets',
            value: parseFloat(financials.returnOnAssets),
            average: getBenchmark('returnOnAssets'),
            min: 0, max: 2.5, inverse: false, suffix: '%'
        };
    }
    if (text.includes('return on equity') || text.includes('roe ')) {
        return {
            metric: 'Return on Equity',
            value: parseFloat(financials.returnOnEquity),
            average: getBenchmark('returnOnEquity'),
            min: 0, max: 25, inverse: false, suffix: '%'
        };
    }
    if (text.includes('net interest margin') || text.includes('nim')) {
        return {
            metric: 'Net Interest Margin',
            value: parseFloat(financials.netInterestMargin),
            average: getBenchmark('netInterestMargin'),
            min: 0, max: 6, inverse: false, suffix: '%'
        };
    }
    if (text.includes('asset') && text.includes('growth')) {
        return {
            metric: 'Asset Growth (3Y)',
            value: parseFloat(financials.assetGrowth3Y),
            average: getBenchmark('assetGrowth3Y'),
            min: -10, max: 30, inverse: false, suffix: '%'
        };
    }
    if (text.includes('npl') || text.includes('non-performing')) {
        return {
            metric: 'NPL Ratio',
            value: parseFloat(financials.nptlRatio),
            average: getBenchmark('nptlRatio'),
            min: 0, max: 5, inverse: true, suffix: '%'
        };
    }
    return null;
};

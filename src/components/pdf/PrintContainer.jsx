import React from 'react';
import Slide1_CoreMetrics from './Slide1_CoreMetrics';
import Slide2_Returns from './Slide2_Returns';
import Slide3_ExecutiveSummary from './Slide3_ExecutiveSummary';
import Slide4_PeerGroup from './Slide4_PeerGroup';

const PrintContainer = ({ financials, benchmarks, aiSummary }) => {
    if (!financials) return null;

    const bankName = financials.raw?.NAME || 'Target Bank';

    return (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
            <Slide1_CoreMetrics financials={financials} benchmarks={benchmarks} bankName={bankName} />
            <Slide2_Returns financials={financials} benchmarks={benchmarks} bankName={bankName} />
            <Slide3_ExecutiveSummary aiSummary={aiSummary} bankName={bankName} />
            <Slide4_PeerGroup benchmarks={benchmarks} bankName={bankName} />
        </div>
    );
};

export default PrintContainer;

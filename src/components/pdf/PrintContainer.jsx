import React from 'react';
import Slide1_CoreMetrics from './Slide1_CoreMetrics';
import Slide2_Returns from './Slide2_Returns';

const PrintContainer = ({ financials, benchmarks }) => {
    if (!financials) return null;

    const bankName = financials.raw?.NAME || 'Target Bank';

    return (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
            <Slide1_CoreMetrics financials={financials} benchmarks={benchmarks} bankName={bankName} />
            <Slide2_Returns financials={financials} benchmarks={benchmarks} bankName={bankName} />
        </div>
    );
};

export default PrintContainer;

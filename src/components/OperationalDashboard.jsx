import React, { useState, useEffect } from 'react';
import GaugeChart from './GaugeChart';
import benchmarkData from '../data/operationalBenchmarks.json';
import { useAuth } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';

const OperationalDashboard = ({ assetSize = 0 }) => {
    const { user } = useAuth();

    // FDIC ASSET is in thousands. 10 Billion = 10,000,000
    const defaultPeerGroup = assetSize >= 10000000 ? 'regionalBank_over10B' : 'communityBank_under10B';
    const [selectedPeerGroup] = useState(defaultPeerGroup);

    // #6 Form data persistence via sessionStorage
    const [formData, setFormData] = useState(() => {
        try {
            const saved = sessionStorage.getItem('opDashboardFormData');
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return {
            digitalAdoptionRate: '',
            digitalAccountOpening: '',
            vendorSpendPercent: '',
            avgAgeCustomer: '',
            netPromoterScore: ''
        };
    });

    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [formError, setFormError] = useState('');

    const currentBenchmarks = benchmarkData[selectedPeerGroup];

    // Sync formData to sessionStorage immediately when it changes
    useEffect(() => {
        try {
            sessionStorage.setItem('opDashboardFormData', JSON.stringify(formData));
        } catch { /* ignore */ }
    }, [formData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
        setFormError(''); // Clear error when user types
    };

    const handleUnlock = () => {
        // Validation
        const isFormComplete = Object.values(formData).every(val => val !== '');

        if (!isFormComplete) {
            setFormError('Please fill out all fields to generate an accurate scorecard.');
            return;
        }

        // Logic branching based on Auth
        if (user) {
            setIsUnlocked(true);
        } else {
            setIsLoginModalOpen(true);
        }
    };

    // If user successfully logs in while the modal was open (and form was complete), unlock the dashboard
    React.useEffect(() => {
        if (user && isLoginModalOpen) {
            setIsLoginModalOpen(false);
            setIsUnlocked(true);
        }
    }, [user, isLoginModalOpen]);

    return (
        <div className="relative mt-8">
            <div className="flex justify-between items-end border-b border-slate-700/50 pb-2 mb-6">
                <h2 className="text-2xl font-bold text-white">Operational Efficiency</h2>
            </div>

            {/* Locked Overlay - Only show if NOT unlocked */}
            {!isUnlocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-2xl border border-slate-800/50">
                    <div className="bg-slate-900 p-8 rounded-xl shadow-2xl border border-slate-700 max-w-2xl w-full text-center relative pointer-events-auto ring-1 ring-white/5">
                        <h3 className="text-2xl font-bold text-white mb-2">Unlock Your Full Scorecard</h3>
                        <p className="text-slate-400 mb-6">
                            Enter your operational data to see how you stack up against industry peers.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Digital Adoption Rate (%)</label>
                                <input
                                    type="number"
                                    name="digitalAdoptionRate"
                                    value={formData.digitalAdoptionRate}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.digitalAdoptionRate.average}`}
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Digital Acct Opening (%)</label>
                                <input
                                    type="number"
                                    name="digitalAccountOpening"
                                    value={formData.digitalAccountOpening}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.digitalAccountOpening.average}`}
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Vendor Spend (% of OpEx)</label>
                                <input
                                    type="number"
                                    name="vendorSpendPercent"
                                    value={formData.vendorSpendPercent}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.vendorSpendPercent.average}`}
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Avg Age of Customer (Yrs)</label>
                                <input
                                    type="number"
                                    name="avgAgeCustomer"
                                    value={formData.avgAgeCustomer}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.avgAgeCustomer.average}`}
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300 mb-1">Net Promoter Score (NPS)</label>
                                <input
                                    type="number"
                                    name="netPromoterScore"
                                    value={formData.netPromoterScore}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.netPromoterScore.average}`}
                                    className="w-full bg-slate-800 border-slate-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-500"
                                />
                            </div>
                        </div>

                        {formError && (
                            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded border border-red-100 text-sm font-medium animate-shake">
                                {formError}
                            </div>
                        )}

                        <button
                            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105 flex items-center justify-center mx-auto gap-2"
                            onClick={handleUnlock}
                        >
                            {!user && (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            )}
                            Compare My Bank
                        </button>
                    </div>
                </div>
            )}

            {/* Login Modal */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />

            {/* Gauges Grid */}
            {/* If NOT unlocked: opacity-50, blur, and use Benchmark Data. */}
            {/* If unlocked: normal opacity, no blur, and use Form Data (User Input). */}
            <div className={`bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-slate-700/50 ring-1 ring-white/5 transition-all duration-500 ${!isUnlocked ? 'opacity-50 filter blur-[2px]' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
                    <GaugeChart
                        label="Digital Adoption"
                        value={isUnlocked ? Number(formData.digitalAdoptionRate) : currentBenchmarks.digitalAdoptionRate.average}
                        min={0}
                        max={100}
                        average={currentBenchmarks.digitalAdoptionRate.average}
                        p25={currentBenchmarks.digitalAdoptionRate.bottomQuartile}
                        p75={currentBenchmarks.digitalAdoptionRate.topQuartile}
                    />
                    <GaugeChart
                        label="Digital Acct Opening"
                        value={isUnlocked ? Number(formData.digitalAccountOpening) : currentBenchmarks.digitalAccountOpening.average}
                        min={0}
                        max={100}
                        average={currentBenchmarks.digitalAccountOpening.average}
                        p25={currentBenchmarks.digitalAccountOpening.bottomQuartile}
                        p75={currentBenchmarks.digitalAccountOpening.topQuartile}
                    />
                    <GaugeChart
                        label="Vendor Spend %"
                        value={isUnlocked ? Number(formData.vendorSpendPercent) : currentBenchmarks.vendorSpendPercent.average}
                        min={0}
                        max={30}
                        average={currentBenchmarks.vendorSpendPercent.average}
                        p25={currentBenchmarks.vendorSpendPercent.bottomQuartile}
                        p75={currentBenchmarks.vendorSpendPercent.topQuartile}
                        inverse={true}
                    />
                    <GaugeChart
                        label="Avg Age Customer"
                        value={isUnlocked ? Number(formData.avgAgeCustomer) : currentBenchmarks.avgAgeCustomer.average}
                        min={20}
                        max={80}
                        average={currentBenchmarks.avgAgeCustomer.average}
                        p25={currentBenchmarks.avgAgeCustomer.bottomQuartile}
                        p75={currentBenchmarks.avgAgeCustomer.topQuartile}
                        inverse={true}
                        suffix=""
                    />
                    <GaugeChart
                        label="NPS"
                        value={isUnlocked ? Number(formData.netPromoterScore) : currentBenchmarks.netPromoterScore.average}
                        min={-100}
                        max={100}
                        average={currentBenchmarks.netPromoterScore.average}
                        p25={currentBenchmarks.netPromoterScore.bottomQuartile}
                        p75={currentBenchmarks.netPromoterScore.topQuartile}
                        suffix=""
                    />
                </div>
            </div>

            {/* Citations & Disclaimer Footer (Only fully visible when unlocked) */}
            <div className={`mt-12 pt-6 border-t border-slate-800 transition-opacity duration-1000 ${isUnlocked ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        About this Data
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        <strong>Disclaimer:</strong> This application is currently in its testing phase. For testing purposes only, your data has not been stored. Unlike the FDIC financial data on the main dashboard, which is sourced directly from regulatory Call Reports, operational metrics (such as digital adoption, account opening, and vendor spend averages) are not publicly filed by banks.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        The peer group averages and quartile ranges displayed above are synthesized on a best-effort basis from aggregated 2024-2025 industry research reports, surveys, and consulting benchmarks aimed at community and regional banking institutions. They should be used for general comparison and directional guidance only, not as definitive financial advice.
                    </p>
                    <div className="text-[10px] text-slate-500">
                        <strong>Primary Data Sources (Aggregated 2024 Research):</strong>
                        <span className="ml-1">
                            <a href="https://www.bny.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">BNY Mellon Community Bank Survey</a>,
                            <a href="https://www.csbs.org" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:text-blue-300 hover:underline">CSBS Annual Survey</a>,
                            <a href="https://thefinancialbrand.com" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:text-blue-300 hover:underline">The Financial Brand Industry Reports</a>,
                            <a href="https://www.alkami.com" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:text-blue-300 hover:underline">Alkami Telemetry Data</a>.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OperationalDashboard;

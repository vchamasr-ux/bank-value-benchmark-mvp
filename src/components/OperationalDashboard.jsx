import React, { useState } from 'react';
import GaugeChart from './GaugeChart';
import benchmarkData from '../data/operationalBenchmarks.json';
import { useAuth } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';

const OperationalDashboard = () => {
    const { user } = useAuth();
    const [selectedPeerGroup, setSelectedPeerGroup] = useState('communityBank_under10B');
    const [formData, setFormData] = useState({
        digitalAdoptionRate: '',
        digitalAccountOpening: '',
        vendorSpendPercent: '',
        avgAgeCustomer: '',
        netPromoterScore: ''
    });

    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [formError, setFormError] = useState('');

    const currentBenchmarks = benchmarkData[selectedPeerGroup];

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
            <div className="flex justify-between items-end border-b pb-2 mb-6">
                <h2 className="text-2xl font-bold text-blue-900">Operational Efficiency</h2>
            </div>

            {/* Locked Overlay - Only show if NOT unlocked */}
            {!isUnlocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200">
                    <div className="bg-white p-8 rounded-xl shadow-2xl border border-blue-100 max-w-2xl w-full text-center relative pointer-events-auto">
                        <h3 className="text-2xl font-bold text-blue-900 mb-2">Unlock Your Full Scorecard</h3>
                        <p className="text-gray-600 mb-6">
                            Enter your operational data to see how you stack up against industry peers.
                        </p>

                        <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <span className="text-sm font-medium text-slate-700">Compare against:</span>
                            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                                <button
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${selectedPeerGroup === 'communityBank_under10B' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
                                    onClick={() => setSelectedPeerGroup('communityBank_under10B')}
                                >
                                    Community Bank (&lt;$10B)
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${selectedPeerGroup === 'regionalBank_over10B' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
                                    onClick={() => setSelectedPeerGroup('regionalBank_over10B')}
                                >
                                    Regional Bank (&gt;$10B)
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Digital Adoption Rate (%)</label>
                                <input
                                    type="number"
                                    name="digitalAdoptionRate"
                                    value={formData.digitalAdoptionRate}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.digitalAdoptionRate.average}`}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Digital Acct Opening (%)</label>
                                <input
                                    type="number"
                                    name="digitalAccountOpening"
                                    value={formData.digitalAccountOpening}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.digitalAccountOpening.average}`}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Spend (% of OpEx)</label>
                                <input
                                    type="number"
                                    name="vendorSpendPercent"
                                    value={formData.vendorSpendPercent}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.vendorSpendPercent.average}`}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Avg Age of Customer (Yrs)</label>
                                <input
                                    type="number"
                                    name="avgAgeCustomer"
                                    value={formData.avgAgeCustomer}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.avgAgeCustomer.average}`}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Net Promoter Score (NPS)</label>
                                <input
                                    type="number"
                                    name="netPromoterScore"
                                    value={formData.netPromoterScore}
                                    onChange={handleChange}
                                    placeholder={`e.g. ${currentBenchmarks.netPromoterScore.average}`}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center transition-all duration-500 ${!isUnlocked ? 'opacity-50 filter blur-[2px]' : ''}`}>
                <GaugeChart
                    label="Digital Adoption"
                    value={isUnlocked ? Number(formData.digitalAdoptionRate) : currentBenchmarks.digitalAdoptionRate.average}
                    min={0}
                    max={100}
                    average={currentBenchmarks.digitalAdoptionRate.average}
                    topQuartile={currentBenchmarks.digitalAdoptionRate.topQuartile}
                    bottomQuartile={currentBenchmarks.digitalAdoptionRate.bottomQuartile}
                />
                <GaugeChart
                    label="Digital Acct Opening"
                    value={isUnlocked ? Number(formData.digitalAccountOpening) : currentBenchmarks.digitalAccountOpening.average}
                    min={0}
                    max={100}
                    average={currentBenchmarks.digitalAccountOpening.average}
                    topQuartile={currentBenchmarks.digitalAccountOpening.topQuartile}
                    bottomQuartile={currentBenchmarks.digitalAccountOpening.bottomQuartile}
                />
                <GaugeChart
                    label="Vendor Spend %"
                    value={isUnlocked ? Number(formData.vendorSpendPercent) : currentBenchmarks.vendorSpendPercent.average}
                    min={0}
                    max={30}
                    average={currentBenchmarks.vendorSpendPercent.average}
                    topQuartile={currentBenchmarks.vendorSpendPercent.topQuartile}
                    bottomQuartile={currentBenchmarks.vendorSpendPercent.bottomQuartile}
                    inverse={true}
                />
                <GaugeChart
                    label="Avg Age Customer"
                    value={isUnlocked ? Number(formData.avgAgeCustomer) : currentBenchmarks.avgAgeCustomer.average}
                    min={20}
                    max={80}
                    average={currentBenchmarks.avgAgeCustomer.average}
                    topQuartile={currentBenchmarks.avgAgeCustomer.topQuartile}
                    bottomQuartile={currentBenchmarks.avgAgeCustomer.bottomQuartile}
                    inverse={true}
                />
                <GaugeChart
                    label="NPS"
                    value={isUnlocked ? Number(formData.netPromoterScore) : currentBenchmarks.netPromoterScore.average}
                    min={-100}
                    max={100}
                    average={currentBenchmarks.netPromoterScore.average}
                    topQuartile={currentBenchmarks.netPromoterScore.topQuartile}
                    bottomQuartile={currentBenchmarks.netPromoterScore.bottomQuartile}
                />
            </div>

            {/* Citations & Disclaimer Footer (Only fully visible when unlocked) */}
            <div className={`mt-12 pt-6 border-t border-slate-100 transition-opacity duration-1000 ${isUnlocked ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        About this Data
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        <strong>Disclaimer:</strong> This application is currently in its testing phase. Unlike the FDIC financial data on the main dashboard, which is sourced directly from regulatory Call Reports, operational metrics (such as digital adoption, account opening, and vendor spend averages) are not publicly filed by banks.
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        The peer group averages and quartile ranges displayed above are synthesized on a best-effort basis from aggregated 2025-2026 industry research reports, surveys, and consulting benchmarks aimed at community and regional banking institutions. They should be used for general comparison and directional guidance only, not as definitive financial advice.
                    </p>
                    <div className="text-[10px] text-slate-500">
                        <strong>Primary Data Sources (Aggregated 2025/2026):</strong>
                        <span className="ml-1">
                            <a href="https://www.q2.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Q2 State of Commercial Banking</a>,
                            <a href="https://www.csbs.org/community-bank-survey" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">CSBS Annual Survey of Community Banks</a>,
                            <a href="https://www.alkami.com/report/data-telemetry-report/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">Alkami Telemetry Report</a>,
                            <a href="https://www.questionpro.com/blog/nps-benchmarks/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">QuestionPro Benchmark Reports</a>.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OperationalDashboard;

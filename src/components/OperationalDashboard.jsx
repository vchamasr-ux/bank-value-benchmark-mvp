import React, { useState } from 'react';
import GaugeChart from './GaugeChart';
import benchmarkData from '../data/operationalBenchmarks.json';

const OperationalDashboard = () => {
    // Phase 3: Locked state.
    // Phase 4: Handle unlock state.
    const [formData, setFormData] = useState({
        digitalAdoptionRate: '',
        digitalAccountOpening: '',
        vendorSpendPercent: '',
        avgAgeCustomer: '',
        netPromoterScore: ''
    });

    const [isUnlocked, setIsUnlocked] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleUnlock = () => {
        // Basic validation could go here. For now, we simulate the "Exchange".
        setIsUnlocked(true);
    };

    return (
        <div className="relative mt-8">
            <h2 className="text-2xl font-bold text-blue-900 border-b pb-2 mb-6">Operational Efficiency</h2>

            {/* Locked Overlay - Only show if NOT unlocked */}
            {!isUnlocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200">
                    <div className="bg-white p-8 rounded-xl shadow-2xl border border-blue-100 max-w-2xl w-full text-center">
                        <h3 className="text-2xl font-bold text-blue-900 mb-2">Unlock Your Full Scorecard</h3>
                        <p className="text-gray-600 mb-6">
                            Enter your operational data to see how you stack up against industry peers.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Digital Adoption Rate (%)</label>
                                <input
                                    type="number"
                                    name="digitalAdoptionRate"
                                    value={formData.digitalAdoptionRate}
                                    onChange={handleChange}
                                    placeholder="e.g. 60"
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
                                    placeholder="e.g. 25"
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
                                    placeholder="e.g. 12"
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
                                    placeholder="e.g. 52"
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
                                    placeholder="e.g. 50"
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <button
                            className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105"
                            onClick={handleUnlock}
                        >
                            Compare My Bank
                        </button>
                    </div>
                </div>
            )}

            {/* Gauges Grid */}
            {/* If NOT unlocked: opacity-50, blur, and use Benchmark Data. */}
            {/* If unlocked: normal opacity, no blur, and use Form Data (User Input). */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center transition-all duration-500 ${!isUnlocked ? 'opacity-50 pointer-events-none filter blur-[2px]' : ''}`}>
                <GaugeChart
                    label="Digital Adoption"
                    value={isUnlocked ? Number(formData.digitalAdoptionRate) : benchmarkData.digitalAdoptionRate}
                    min={0}
                    max={100}
                    average={benchmarkData.digitalAdoptionRate}
                />
                <GaugeChart
                    label="Digital Acct Opening"
                    value={isUnlocked ? Number(formData.digitalAccountOpening) : benchmarkData.digitalAccountOpening}
                    min={0}
                    max={100}
                    average={benchmarkData.digitalAccountOpening}
                />
                <GaugeChart
                    label="Vendor Spend %"
                    value={isUnlocked ? Number(formData.vendorSpendPercent) : benchmarkData.vendorSpendPercent}
                    min={0}
                    max={30}
                    average={benchmarkData.vendorSpendPercent}
                    inverse={true}
                />
                <GaugeChart
                    label="Avg Age Customer"
                    value={isUnlocked ? Number(formData.avgAgeCustomer) : benchmarkData.avgAgeCustomer}
                    min={20}
                    max={80}
                    average={benchmarkData.avgAgeCustomer}
                    inverse={true}
                />
                <GaugeChart
                    label="NPS"
                    value={isUnlocked ? Number(formData.netPromoterScore) : benchmarkData.netPromoterScore}
                    min={-100}
                    max={100}
                    average={benchmarkData.netPromoterScore}
                />
            </div>
        </div>
    );
};

export default OperationalDashboard;

import React, { useState, useEffect } from 'react';

const SummaryModal = ({ isOpen, onClose, financials, benchmarks }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && !summary && !isLoading && !error) {
            generateSummary();
        }
    }, [isOpen]);

    const generateSummary = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            // Format the data
            const promptData = {
                financials: financials,
                benchmarks: benchmarks
            };

            const getCircularReplacer = () => {
                const seen = new WeakSet();
                return (key, value) => {
                    if (typeof value === "object" && value !== null) {
                        if (seen.has(value)) {
                            return "[Circular]";
                        }
                        seen.add(value);
                    }
                    return value;
                };
            };

            const bankName = financials?.name || financials?.raw?.NAME || 'the bank';

            const prompt = `You are a financial analyst. Analyze the following financial and benchmark data for ${bankName}. 
CRITICAL CONTEXT: 
1. ALL absolute dollar values in the raw FDIC data (like assets, income, etc.) are denominated in THOUSANDS of US Dollars ($000s). For example, "3800000" means $3.8 Billion. Keep this scale in mind when writing your analysis and avoid confusing billions with trillions.
2. The benchmark data provides averages for a peer group. Note that the peer group may include banks of different absolute sizes, so focus your analysis on proportional metrics (like ratios, margins, percentages) rather than absolute dollar comparisons.

Provide a detailed, professional summary of their financial health based ONLY on the data provided. Highlight their strengths and weaknesses compared to the peer group. Use Markdown formatting.

Data:
${JSON.stringify(promptData, getCircularReplacer(), 2)}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                if (response.status === 429 || (errData.error && errData.error.code === 429)) {
                    throw new Error("Gemini API daily quota exceeded. Please try again later or provide a different API key.");
                }
                throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const textSummary = data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";

            setSummary(textSummary);
        } catch (err) {
            console.error("Gemini API Error:", err);
            setError(err.message || 'Failed to generate summary');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    // Helper to render simple markdown formatting
    const renderSummary = (text) => {
        return text.split('\n\n').map((paragraph, idx) => {
            const trimPara = paragraph.trim();

            // Handle headers
            if (trimPara.startsWith('### ')) {
                return <h4 key={idx} className="text-lg font-bold text-blue-800 mt-6 mb-3">{trimPara.substring(4).replace(/\*\*/g, '')}</h4>;
            }
            if (trimPara.startsWith('## ')) {
                return <h3 key={idx} className="text-xl font-bold text-blue-900 mt-8 mb-4 border-b border-gray-100 pb-2">{trimPara.substring(3).replace(/\*\*/g, '')}</h3>;
            }
            if (trimPara.startsWith('# ')) {
                return <h2 key={idx} className="text-2xl font-bold text-blue-900 mt-8 mb-6 border-b-2 border-blue-100 pb-2">{trimPara.substring(2).replace(/\*\*/g, '')}</h2>;
            }

            // Sometimes headers have ** like **## Title** or it's formatted weirdly
            const boldHeaderMatch = trimPara.match(/^\*\*(#+)\s(.*?)\*\*$/);
            if (boldHeaderMatch) {
                const level = boldHeaderMatch[1].length;
                const content = boldHeaderMatch[2];
                if (level === 1) return <h2 key={idx} className="text-2xl font-bold text-blue-900 mt-8 mb-6 border-b-2 border-blue-100 pb-2">{content}</h2>;
                if (level === 2) return <h3 key={idx} className="text-xl font-bold text-blue-900 mt-8 mb-4 border-b border-gray-100 pb-2">{content}</h3>;
                return <h4 key={idx} className="text-lg font-bold text-blue-800 mt-6 mb-3">{content}</h4>;
            }

            // Check if it's purely a bold header without #
            if (trimPara.match(/^\*\*[^*]+\*\*$/) && trimPara.length < 100) {
                return <h4 key={idx} className="text-lg font-bold text-blue-800 mt-6 mb-3">{trimPara.slice(2, -2)}</h4>;
            }

            // Process bold **text** and list items
            const processBlock = (blockText) => {
                // If the block has line breaks for list items
                return blockText.split('\n').map((line, lineIdx) => {
                    const isListItem = line.trim().startsWith('* ') || line.trim().startsWith('- ');
                    const cleanLine = isListItem ? line.trim().substring(2) : line;

                    const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
                    const renderedLine = parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    });

                    if (isListItem) {
                        return (
                            <div key={lineIdx} className="flex items-start ml-4 mb-2">
                                <span className="text-blue-500 mr-2 mt-0.5">•</span>
                                <span>{renderedLine}</span>
                            </div>
                        );
                    }

                    // Normal line inside paragraph
                    return <React.Fragment key={lineIdx}>{renderedLine}{lineIdx < blockText.split('\n').length - 1 ? <br /> : null}</React.Fragment>;
                });
            };

            return (
                <p key={idx} className="mb-4">
                    {processBlock(trimPara)}
                </p>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-blue-900">AI Financial Analysis</h3>
                            <p className="text-sm text-gray-500 mt-1">Powered by Gemini 2.5 Flash</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-200 bg-gray-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto p-8 flex-1 bg-white">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-6">
                            <div className="relative">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 border-t-transparent shadow-lg"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-6 w-6 rounded-full bg-blue-100"></div>
                                </div>
                            </div>
                            <p className="text-gray-600 font-medium animate-pulse text-lg">Analyzing financial data and peers...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg max-w-2xl mx-auto mt-4">
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-red-800 font-bold text-lg">Analysis Failed</h4>
                            </div>
                            <p className="mt-2 text-red-700 ml-9">{error}</p>
                        </div>
                    ) : (
                        <div className="text-gray-700 leading-relaxed text-base max-w-3xl mx-auto text-left">
                            {summary ? renderSummary(summary) : <p className="text-gray-500 italic text-center mt-10">Analysis is empty.</p>}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={generateSummary}
                        disabled={isLoading}
                        className="px-5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-bold focus:outline-none transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SummaryModal;

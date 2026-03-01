import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth/AuthContext';
import LoginModal from './auth/LoginModal';
import { generateHtmlBriefString } from '../utils/exportHtmlBrief';
import useRetryCountdown from '../hooks/useRetryCountdown';

const SummaryModal = ({ isOpen, onClose, financials, benchmarks, authRequired = true, onSummaryGenerated }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const { user } = useAuth();

    // Shared retry countdown hook — fires generateSummary() automatically when countdown hits 0
    const { retryCountdown, retryCount, setRetryFromError, resetRetry } = useRetryCountdown(() => {
        if (generateSummary) generateSummary();
    });

    const handleCopy = async () => {
        if (!summary) return;
        try {
            await navigator.clipboard.writeText(summary);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const handleExportHTML = () => {
        try {
            const htmlString = generateHtmlBriefString(financials, benchmarks, { summary });
            const blob = new Blob([htmlString], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (financials?.name || financials?.raw?.NAME || 'Bank').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const reportDate = financials?.reportDate ? financials.reportDate.replace(/\s+/g, '_') : 'latest';
            a.download = `${safeName}_Executive_Brief_${reportDate}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to generate export:', err);
            alert("Failed to generate export: " + err.message);
        }
    };

    const handleSave = async () => {
        if (!summary || !user) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/briefs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-linkedin-sub': user.sub
                },
                body: JSON.stringify({
                    bankName: financials?.name || financials?.raw?.NAME || 'Selected Bank',
                    type: 'financial_summary',
                    data: summary
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || response.statusText);
            }

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            console.error(err);
            alert("Failed to save brief: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const generateSummary = useCallback(async () => {
        if (!user && authRequired) {
            setIsLoginModalOpen(true);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // Shared serializer — defined once, used by both dev and production paths
            const getCircularReplacer = () => {
                const seen = new WeakSet();
                return (key, value) => {
                    if (typeof value === "object" && value !== null) {
                        if (seen.has(value)) return "[Circular]";
                        seen.add(value);
                    }
                    return value;
                };
            };

            let textResult = "";

            const url = `/api/insights`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-linkedin-sub': user?.sub || 'anonymous',
                    'x-linkedin-name': user?.name || ''
                },
                body: JSON.stringify({
                    financials,
                    benchmarks
                }, getCircularReplacer())
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error || response.statusText;

                if (response.status === 429) {
                    // Check if this is a daily quota or a rate limit
                    if (errorMsg.toLowerCase().includes('daily quota')) {
                        throw new Error("DAILY_QUOTA: Daily AI quota reached (2/2). Try again tomorrow.");
                    }
                    // Otherwise it's likely a Gemini rate limit (retryable)
                    throw new Error(`RATE_LIMIT: ${errorMsg}`);
                }
                throw new Error(errorMsg || "Failed to generate summary");
            }
            const data = await response.json();
            textResult = data.text || "No summary generated.";
            setSummary(textResult);
            if (onSummaryGenerated && textResult) {
                onSummaryGenerated(textResult);
            }
            resetRetry(); // Reset retry tracker on success
        } catch (err) {
            console.error("AI Insights Error:", err);

            if (err.message.startsWith('RATE_LIMIT:')) {
                if (retryCount >= 1) {
                    setError("Daily AI quota reached. Please try again tomorrow.");
                } else {
                    setRetryFromError(err.message.replace('RATE_LIMIT:', '').trim());
                    setError(null);
                }
            } else if (err.message.startsWith('DAILY_QUOTA:')) {
                setError(err.message.replace('DAILY_QUOTA:', '').trim());
            } else {
                setError(err.message || 'Failed to generate summary');
            }
        } finally {
            setIsLoading(false);
        }
    }, [user, financials, benchmarks, authRequired, retryCount, resetRetry, setRetryFromError, onSummaryGenerated]);

    useEffect(() => {
        if (isOpen && !summary && !isLoading && !error && (user || !authRequired)) {
            generateSummary();
        } else if (isOpen && !user && !isLoginModalOpen && authRequired) {
            setIsLoginModalOpen(true);
        }
    }, [isOpen, user, authRequired, summary, isLoading, error, isLoginModalOpen, generateSummary]);

    const handleLoginSuccess = () => {
        setIsLoginModalOpen(false);
        generateSummary();
    };

    if (!isOpen) return null;

    // Helper to render simple markdown formatting
    const renderSummary = (text) => {
        return text.split('\n\n').map((paragraph, idx) => {
            const trimPara = paragraph.trim();

            // Handle headers
            if (trimPara.startsWith('#### ')) {
                return <h5 key={idx} className="text-md font-bold text-blue-700 mt-4 mb-2">{trimPara.substring(5).replace(/\*\*/g, '')}</h5>;
            }
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
                if (level === 3) return <h4 key={idx} className="text-lg font-bold text-blue-800 mt-6 mb-3">{content}</h4>;
                return <h5 key={idx} className="text-md font-bold text-blue-700 mt-4 mb-2">{content}</h5>;
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
                    {retryCountdown !== null ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-6">
                            <div className="relative">
                                <div className="text-4xl font-mono text-blue-900 font-bold">{retryCountdown}</div>
                                <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 w-24 h-24">
                                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-blue-100" />
                                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="276" strokeDashoffset={276 - (retryCountdown / 60) * 276} className="text-blue-500 transition-all duration-1000 ease-linear" />
                                </svg>
                            </div>
                            <div className="text-center mt-4">
                                <h4 className="text-lg font-bold text-gray-900 mb-1">Catching our breath</h4>
                                <p className="text-gray-500 text-sm">Gemini free-tier rate limit reached. Auto-resuming shortly.</p>
                            </div>
                        </div>
                    ) : isLoading ? (
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

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between rounded-b-xl">
                    <div>
                        {summary && !isLoading && !error && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopy}
                                    className={`px-4 py-2.5 rounded-lg text-sm font-bold focus:outline-none transition-all flex items-center gap-2 ${isCopied
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
                                        }`}
                                    title="Copy to Clipboard"
                                >
                                    {isCopied ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                            </svg>
                                            Copy Report
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleExportHTML}
                                    className="px-4 py-2.5 bg-blue-900 border border-blue-900 text-white hover:bg-blue-800 rounded-lg text-sm font-bold focus:outline-none transition-all flex items-center gap-2 shadow-sm"
                                    title="Download interactive Executive Brief"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export HTML Brief
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`px-4 py-2.5 rounded-lg text-sm font-bold focus:outline-none transition-all flex items-center gap-2 ${saveSuccess
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm'
                                        }`}
                                    title="Save Brief to Profile"
                                >
                                    {saveSuccess ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Saved!
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            {isSaving ? 'Saving...' : 'Save Brief'}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
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

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => {
                    setIsLoginModalOpen(false);
                    onClose(); // Also close summary modal since we can't generate without auth
                }}
                onLoginSuccess={handleLoginSuccess}
            />
        </div >
    );
};

export default SummaryModal;

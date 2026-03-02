import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth/AuthContext';

const SavedBriefsModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [briefs, setBriefs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedBrief, setSelectedBrief] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // NOTE: fetchBriefs MUST be declared before the useEffect that references it
    // in its dependency array. Both are const — not hoisted. Rollup minifies
    // fetchBriefs to a short name ('x') and crashes with TDZ if useEffect
    // evaluates first. Declaration order is the only fix.
    const fetchBriefs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/briefs', {
                method: 'GET',
                headers: {
                    'x-linkedin-sub': user.sub
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || response.statusText);
            }

            const data = await response.json();
            if (!data.briefs || !Array.isArray(data.briefs)) {
                throw new Error("CRITICAL: API response missing 'briefs' array.");
            }
            setBriefs(data.briefs);
        } catch (err) {
            console.error("Failed to fetch saved briefs:", err);
            setError(err.message || "Failed to load saved briefs");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isOpen && user) {
            fetchBriefs();
        } else if (!isOpen) {
            setSelectedBrief(null);
        }
    }, [isOpen, user, fetchBriefs]);

    const handleDelete = async (briefId, e) => {
        e.stopPropagation();

        // First click: show inline confirm
        if (confirmDeleteId !== briefId) {
            setConfirmDeleteId(briefId);
            return;
        }

        // Second click: actually delete
        setConfirmDeleteId(null);
        try {
            const response = await fetch('/api/briefs', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-linkedin-sub': user.sub
                },
                body: JSON.stringify({ briefId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || response.statusText);
            }

            setBriefs((prev) => prev.filter((b) => b.id !== briefId));
            if (selectedBrief?.id === briefId) {
                setSelectedBrief(null);
            }
        } catch (err) {
            setError("Failed to delete brief: " + err.message);
        }
    };

    if (!isOpen) return null;

    // Helper to render markdown formatting similarly to SummaryModal
    const renderMarkdown = (text) => {
        if (!text) return null;
        return text.split('\n\n').map((paragraph, idx) => {
            const trimPara = paragraph.trim();

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

            const boldHeaderMatch = trimPara.match(/^\*\*(#+)\s(.*?)\*\*$/);
            if (boldHeaderMatch) {
                const level = boldHeaderMatch[1].length;
                const content = boldHeaderMatch[2];
                if (level === 1) return <h2 key={idx} className="text-2xl font-bold text-blue-900 mt-8 mb-6 border-b-2 border-blue-100 pb-2">{content}</h2>;
                if (level === 2) return <h3 key={idx} className="text-xl font-bold text-blue-900 mt-8 mb-4 border-b border-gray-100 pb-2">{content}</h3>;
                if (level === 3) return <h4 key={idx} className="text-lg font-bold text-blue-800 mt-6 mb-3">{content}</h4>;
                return <h5 key={idx} className="text-md font-bold text-blue-700 mt-4 mb-2">{content}</h5>;
            }

            if (trimPara.match(/^\*\*[^*]+\*\*$/) && trimPara.length < 100) {
                return <h4 key={idx} className="text-lg font-bold text-blue-800 mt-6 mb-3">{trimPara.slice(2, -2)}</h4>;
            }

            const processBlock = (blockText) => {
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

    // Helper to render Movers payload
    const renderMoversPayload = (data) => {
        if (!data || !data.banks || !Array.isArray(data.banks)) {
            return <p className="text-gray-500 italic text-center mt-10">Invalid or empty brief data.</p>;
        }

        return (
            <>
                {data.ecosystem_synthesis && (
                    <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-lg p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-indigo-800 bg-indigo-200/50 p-1.5 rounded-md">🌍</span>
                            <h3 className="text-lg font-black text-indigo-900 tracking-tight uppercase">Ecosystem Synthesis</h3>
                        </div>
                        <p className="text-indigo-900 leading-relaxed mb-4 text-sm font-medium">
                            {data.ecosystem_synthesis.executive_summary}
                        </p>
                        <div className="bg-white border border-indigo-100 rounded p-3">
                            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Macro Opportunity</span>
                            <p className="text-sm text-gray-800 font-semibold">{data.ecosystem_synthesis.macro_opportunity}</p>
                        </div>
                    </div>
                )}
                {data.banks.map((bank, idx) => {
                    let confColor = "bg-gray-100 text-gray-800";
                    if (bank.confidence === "High") confColor = "bg-green-100 text-green-800 border border-green-200";
                    if (bank.confidence === "Medium") confColor = "bg-yellow-100 text-yellow-800 border border-yellow-200";
                    if (bank.confidence === "Low") confColor = "bg-red-50 text-red-700 border border-red-200";

                    return (
                        <div key={`bank-${idx}`}>
                            <div className="mt-8 mb-4 border-l-4 border-blue-800 pl-4 py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/30 rounded-r-lg pr-4">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight">{bank.bank_name}</h3>
                                    <p className="text-blue-800 font-semibold text-sm mt-0.5">
                                        Theme: {bank.theme} {bank.threat_level && ` (${bank.threat_level})`}
                                    </p>
                                </div>
                                {bank.confidence && (
                                    <div className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm whitespace-nowrap ${confColor}`}>
                                        {bank.confidence} Confidence
                                    </div>
                                )}
                            </div>
                            {bank.what_changed && bank.what_changed.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">What changed (QoQ):</h4>
                                    <div className="text-gray-700 space-y-2">
                                        {bank.what_changed.map((change, cIdx) => (
                                            <div key={`change-${idx}-${cIdx}`}>
                                                <div className="flex items-start ml-2 mt-2">
                                                    <span className="text-blue-500 mr-2 font-bold text-lg leading-none mt-0.5">•</span>
                                                    <span className="text-sm leading-relaxed">{change.insight}</span>
                                                </div>
                                                {change.evidence && (
                                                    <div className="ml-8 text-[13px] text-gray-600 font-mono bg-slate-50 p-2.5 border border-slate-200 rounded-md my-1 shadow-inner">
                                                        ↳ {change.evidence}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {bank.so_what && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">So what:</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{bank.so_what}</p>
                                </div>
                            )}
                            {bank.actions && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">Actions:</h4>
                                    <div className="text-gray-700 space-y-2">
                                        {bank.actions.defend && (
                                            <div className="flex items-start ml-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 bg-blue-100 text-blue-800`}>DEFEND</span>
                                                <span className="text-sm pt-0.5 leading-relaxed">{bank.actions.defend}</span>
                                            </div>
                                        )}
                                        {bank.actions.attack && (
                                            <div className="flex items-start ml-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 bg-emerald-100 text-emerald-800`}>ATTACK</span>
                                                <span className="text-sm pt-0.5 leading-relaxed">{bank.actions.attack}</span>
                                            </div>
                                        )}
                                        {bank.actions.monitor && (
                                            <div className="flex items-start ml-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider mr-2 bg-purple-100 text-purple-800`}>MONITOR</span>
                                                <span className="text-sm pt-0.5 leading-relaxed">{bank.actions.monitor}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {bank.watch_next_quarter && (
                                <div className="mb-6">
                                    <h4 className="font-bold text-blue-900 border-b border-gray-100 pb-1 mb-3 uppercase tracking-wider text-[11px]">Watch next quarter:</h4>
                                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{bank.watch_next_quarter}</p>
                                </div>
                            )}
                            {idx < data.banks.length - 1 && (
                                <hr className="my-8 border-gray-200" />
                            )}
                        </div>
                    );
                })}
            </>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Side Panel: List of briefs */}
                <div className={`w-full md:w-1/3 border-r border-gray-100 bg-gray-50 flex flex-col ${selectedBrief ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-6 border-b border-gray-200 bg-white">
                        <h3 className="text-xl font-bold text-gray-900">Saved Briefs</h3>
                        <p className="text-sm text-gray-500">Your historical AI research</p>
                    </div>

                    <div className="overflow-y-auto flex-1 p-4 space-y-3">
                        {isLoading ? (
                            <div className="flex justify-center p-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                        ) : error ? (
                            <p className="text-red-500 text-sm text-center p-4">{error}</p>
                        ) : briefs.length === 0 ? (
                            <p className="text-gray-500 text-sm italic text-center p-4 shadow-sm bg-white rounded-lg border border-gray-100">No saved briefs yet.</p>
                        ) : (
                            briefs.map((brief) => (
                                <div
                                    key={brief.id}
                                    onClick={() => setSelectedBrief(brief)}
                                    className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedBrief?.id === brief.id ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-500/20' : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${brief.type === 'market_movers' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {brief.type === 'market_movers' ? 'Radar' : 'Summary'}
                                            </span>
                                        </div>
                                        {confirmDeleteId === brief.id ? (
                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => handleDelete(brief.id, e)}
                                                    className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={(e) => handleDelete(brief.id, e)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete Brief">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-gray-900 mt-2 truncate" title={brief.bankName}>{brief.bankName}</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(brief.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-gray-200 mt-auto md:hidden">
                        <button onClick={onClose} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold shadow-sm">Close</button>
                    </div>
                </div>

                {/* Main Panel: View Brief */}
                <div className={`w-full md:w-2/3 bg-white flex flex-col ${!selectedBrief ? 'hidden md:flex' : 'flex'}`}>
                    {selectedBrief ? (
                        <>
                            <div className="p-6 border-b border-blue-50 flex justify-between items-center bg-gray-50/80">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <button onClick={() => setSelectedBrief(null)} className="md:hidden text-gray-500 hover:text-gray-800">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <h3 className="text-xl font-bold text-blue-900">{selectedBrief.bankName}</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 md:ml-0 ml-8">Saved {new Date(selectedBrief.date).toLocaleString()}</p>
                                </div>
                                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 hidden md:block">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="overflow-y-auto p-8 flex-1 text-gray-700 leading-relaxed text-base">
                                <div className="max-w-3xl mx-auto">
                                    {selectedBrief.type === 'financial_summary'
                                        ? renderMarkdown(selectedBrief.data)
                                        : renderMoversPayload(selectedBrief.data)
                                    }
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 bg-gray-50/50">
                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            </div>
                            <p className="font-medium text-lg text-gray-700">Select a brief to view</p>
                            <p className="text-sm mt-1">Choose from your history on the left.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SavedBriefsModal;

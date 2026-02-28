import React from 'react';
import PresentationSlide from './PresentationSlide';

const Slide3_ExecutiveSummary = ({ aiSummary, bankName }) => {
    if (!aiSummary) return null;

    // Formatting the markdown-style aiSummary simply for the PDF
    const formatContent = (text) => {
        return text.split('\n\n').map((paragraph, idx) => {
            if (paragraph.startsWith('###')) {
                return <h4 key={idx} className="text-2xl font-bold text-blue-900 mt-6 mb-4">{paragraph.replace('### ', '')}</h4>;
            }
            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                return <h4 key={idx} className="text-2xl font-bold text-blue-900 mt-6 mb-4">{paragraph.replace(/\*\*/g, '')}</h4>;
            }
            if (paragraph.startsWith('-')) {
                return (
                    <ul key={idx} className="list-disc pl-8 mb-4 space-y-2 text-xl text-slate-700 leading-relaxed">
                        {paragraph.split('\n').map((item, i) => (
                            <li key={i}>{item.replace('- ', '').replace(/\*\*/g, '')}</li>
                        ))}
                    </ul>
                );
            }
            return <p key={idx} className="text-xl text-slate-700 leading-relaxed mb-4">{paragraph.replace(/\*\*/g, '')}</p>;
        });
    };

    return (
        <PresentationSlide title="AI Executive Summary" bankName={bankName} id="pdf-slide-3">
            <div className="flex-1 flex flex-col gap-10 bg-white p-12 rounded-3xl border border-slate-200 shadow-sm" id="pdf-slide-3">
                <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-8">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-slate-900">Strategic Performance Narrative</h3>
                        <p className="text-lg text-slate-500">Automated Insights & Recommendations</p>
                    </div>
                </div>

                <div className="columns-2 gap-x-16 text-left" style={{ columnFill: 'auto' }}>
                    {formatContent(aiSummary)}
                </div>
            </div>
        </PresentationSlide>
    );
};

export default Slide3_ExecutiveSummary;

import React from 'react';

/**
 * #12 — Top-level error boundary.
 * Catches any uncaught render error in any child component and shows a
 * recoverable "Something went wrong" UI instead of a blank white screen.
 *
 * Usage: wrap <App /> in main.jsx with <ErrorBoundary>.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught a render error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                    <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-10 max-w-lg w-full text-center">
                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-3">Something went wrong</h2>
                        <p className="text-slate-500 mb-2 text-sm leading-relaxed">
                            An unexpected error occurred while rendering. This is usually caused by unexpected data from the FDIC API.
                        </p>
                        <p className="text-xs text-slate-400 font-mono bg-slate-50 rounded px-3 py-2 mb-6 text-left break-words">
                            {this.state.error?.message || 'Unknown error'}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors mr-3"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;

import React from 'react';

// Tile Grid Layout for US States
const STATE_GRID = {
    // Row 0
    AK: { x: 0, y: 0 },
    ME: { x: 11, y: 0 },

    // Row 1
    VT: { x: 10, y: 1 },
    NH: { x: 11, y: 1 },

    // Row 2
    WA: { x: 0, y: 2 }, ID: { x: 1, y: 2 }, MT: { x: 2, y: 2 }, ND: { x: 3, y: 2 }, MN: { x: 4, y: 2 }, IL: { x: 5, y: 2 }, WI: { x: 6, y: 2 }, MI: { x: 7, y: 2 }, NY: { x: 8, y: 2 }, CT: { x: 9, y: 2 }, MA: { x: 10, y: 2 }, RI: { x: 11, y: 2 },

    // Row 3
    OR: { x: 0, y: 3 }, NV: { x: 1, y: 3 }, WY: { x: 2, y: 3 }, SD: { x: 3, y: 3 }, IA: { x: 4, y: 3 }, IN: { x: 5, y: 3 }, OH: { x: 6, y: 3 }, PA: { x: 7, y: 3 }, NJ: { x: 8, y: 3 },

    // Row 4
    CA: { x: 0, y: 4 }, UT: { x: 1, y: 4 }, CO: { x: 2, y: 4 }, NE: { x: 3, y: 4 }, MO: { x: 4, y: 4 }, KY: { x: 5, y: 4 }, WV: { x: 6, y: 4 }, VA: { x: 7, y: 4 }, MD: { x: 8, y: 4 }, DE: { x: 9, y: 4 },

    // Row 5
    AZ: { x: 1, y: 5 }, NM: { x: 2, y: 5 }, KS: { x: 3, y: 5 }, AR: { x: 4, y: 5 }, TN: { x: 5, y: 5 }, NC: { x: 6, y: 5 }, SC: { x: 7, y: 5 }, DC: { x: 8, y: 5 },

    // Row 6
    OK: { x: 3, y: 6 }, LA: { x: 4, y: 6 }, MS: { x: 5, y: 6 }, AL: { x: 6, y: 6 }, GA: { x: 7, y: 6 },

    // Row 7
    HI: { x: 0, y: 7 }, TX: { x: 3, y: 7 }, FL: { x: 7, y: 7 }
};

const USMap = ({ subjectState, peerStates }) => {
    // Determine cell color
    const getCellColor = (stateCode) => {
        if (stateCode === subjectState) return 'bg-blue-800 text-white font-bold ring-2 ring-blue-500';

        const count = peerStates[stateCode] || 0;
        if (count > 5) return 'bg-blue-600 text-white';
        if (count > 2) return 'bg-blue-400 text-white';
        if (count > 0) return 'bg-blue-200 text-blue-900';

        return 'bg-gray-100 text-gray-300';
    };

    return (
        <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Geographic Distribution</h3>
            <div className="relative" style={{ width: '300px', height: '200px' }}>
                {Object.entries(STATE_GRID).map(([state, pos]) => (
                    <div
                        key={state}
                        className={`absolute flex items-center justify-center w-5 h-5 text-[8px] rounded-sm transition-colors cursor-default ${getCellColor(state)}`}
                        style={{
                            left: pos.x * 24, // 24px grid step
                            top: pos.y * 24
                        }}
                        title={`${state}: ${peerStates[state] || 0} Peers`}
                    >
                        {state}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-800 rounded-sm"></div> Subject</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded-sm"></div> Peers</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 rounded-sm"></div> None</div>
            </div>
        </div>
    );
};

export default USMap;

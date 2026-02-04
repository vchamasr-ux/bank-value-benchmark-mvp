
/**
 * Adjacency list for US States (by 2-letter code).
 */
export const ADJACENT_STATES = {
    AK: [], // No land borders with US states
    AL: ['FL', 'GA', 'TN', 'MS'],
    AR: ['LA', 'TX', 'OK', 'MO', 'TN', 'MS'],
    AZ: ['CA', 'NV', 'UT', 'CO', 'NM'],
    CA: ['OR', 'NV', 'AZ'],
    CO: ['WY', 'NE', 'KS', 'OK', 'NM', 'AZ', 'UT'],
    CT: ['RI', 'MA', 'NY'],
    DC: ['MD', 'VA'],
    DE: ['NJ', 'PA', 'MD'],
    FL: ['AL', 'GA'],
    GA: ['SC', 'NC', 'TN', 'AL', 'FL'],
    HI: [],
    IA: ['MN', 'WI', 'IL', 'MO', 'NE', 'SD'],
    ID: ['WA', 'MT', 'WY', 'UT', 'NV', 'OR'],
    IL: ['WI', 'IN', 'KY', 'MO', 'IA'],
    IN: ['MI', 'OH', 'KY', 'IL'],
    KS: ['NE', 'MO', 'OK', 'CO'],
    KY: ['OH', 'WV', 'VA', 'TN', 'MO', 'IL', 'IN'],
    LA: ['TX', 'AR', 'MS'],
    MA: ['NH', 'VT', 'NY', 'CT', 'RI'],
    MD: ['PA', 'DE', 'VA', 'WV', 'DC'],
    ME: ['NH'],
    MI: ['OH', 'IN', 'WI'],
    MN: ['WI', 'IA', 'SD', 'ND'],
    MO: ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],
    MS: ['TN', 'AL', 'LA', 'AR'],
    MT: ['ND', 'SD', 'WY', 'ID'],
    NC: ['VA', 'SC', 'GA', 'TN'],
    ND: ['MN', 'SD', 'MT'],
    NE: ['SD', 'IA', 'MO', 'KS', 'CO', 'WY'],
    NH: ['ME', 'MA', 'VT'],
    NJ: ['NY', 'PA', 'DE'],
    NM: ['CO', 'OK', 'TX', 'AZ', 'UT'],
    NV: ['ID', 'UT', 'AZ', 'CA', 'OR'],
    NY: ['VT', 'MA', 'CT', 'NJ', 'PA'],
    OH: ['PA', 'WV', 'KY', 'IN', 'MI'],
    OK: ['KS', 'MO', 'AR', 'TX', 'NM', 'CO'],
    OR: ['WA', 'ID', 'NV', 'CA'],
    PA: ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
    RI: ['MA', 'CT'],
    SC: ['NC', 'GA'],
    SD: ['ND', 'MN', 'IA', 'NE', 'WY', 'MT'],
    TN: ['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'],
    TX: ['NM', 'OK', 'AR', 'LA'],
    UT: ['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'],
    VA: ['MD', 'DC', 'NC', 'TN', 'KY', 'WV'],
    VT: ['NH', 'MA', 'NY'],
    WA: ['ID', 'OR'],
    WI: ['MI', 'IL', 'IA', 'MN'],
    WV: ['PA', 'MD', 'VA', 'KY', 'OH'],
    WY: ['MT', 'SD', 'NE', 'CO', 'UT', 'ID']
};

/**
 * Get priority score for a peer state relative to a subject state.
 * Score 0: Same State
 * Score 1: Adjacent State
 * Score 2: Other
 * @param {string} subjectState 
 * @param {string} peerState 
 * @returns {number}
 */
export const getProximityScore = (subjectState, peerState) => {
    if (!subjectState || !peerState) return 3;
    if (subjectState === peerState) return 0;

    const adj = ADJACENT_STATES[subjectState];
    if (adj) {
        // Direct neighbor (Score 1)
        if (adj.includes(peerState)) return 1;

        // Secondary neighbor (Score 2)
        // Check if peerState is a neighbor of any of the subjectState's neighbors
        for (const neighbor of adj) {
            const neighborAdj = ADJACENT_STATES[neighbor];
            if (neighborAdj && neighborAdj.includes(peerState)) {
                return 2;
            }
        }
    }

    // National / Far (Score 3)
    return 3;
};

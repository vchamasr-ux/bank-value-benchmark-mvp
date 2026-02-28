/**
 * Format an FDIC asset value (stored in thousands) to a human-readable string.
 * @param {number|string} assetInThousands - Raw FDIC ASSET field value (in $000s)
 * @returns {string} Formatted string, e.g. "$3.80B", "$450.0M"
 */
export const formatAssets = (assetInThousands) => {
    const asset = parseFloat(assetInThousands) * 1000;
    if (asset >= 1e12) return `$${(asset / 1e12).toFixed(2)}T`;
    if (asset >= 1e9) return `$${(asset / 1e9).toFixed(2)}B`;
    if (asset >= 1e6) return `$${(asset / 1e6).toFixed(1)}M`;
    return `$${asset.toLocaleString()}`;
};

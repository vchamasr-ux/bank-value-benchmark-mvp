import os
import sys
import pandas as pd
import numpy as np
import requests
import json
from datetime import datetime
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import root_mean_squared_error
from scipy.optimize import lsq_linear

# Configuration
CONFIG = {
    "limit": 10000,          # Banks to fetch per tier
    "date_range": ["[2024-01-01 TO *]"], # ~2 years
    "features": [
        "efficiencyRatio",
        "nonInterestIncomePercent",
        "yieldOnLoans",
        "costOfFunds"
    ],
    "targets": [
        "returnOnAssets",
        "costOfFunds",
        "netInterestMargin",
        "nptlRatio"
    ],
    # Alignment with fdicService.js getAssetGroupConfig
    "tiers": {
        "<$1B": "ASSET:[0 TO 1000000]",
        "$1B-$10B": "ASSET:[1000000 TO 10000000]",
        "$10B-$50B": "ASSET:[10000000 TO 50000000]",
        "$50B-$100B": "ASSET:[50000000 TO 100000000]",
        "$100B-$250B": "ASSET:[100000000 TO 250000000]",
        ">$250B": "ASSET:[250000000 TO *]"
    }
}

# The FDIC variables we need to calculate our KPIs
# This list is now mostly for reference, as `fields` is hardcoded in fetch_data
FDIC_VARS = [
    "CERT", "REPDTE", "ASSET", "NONIX", "NONII", "INTEXP", "EINTEXP",
    "INTINC", "LNLSNET", "NUMEMP", "NETINC", "EQ", "NCLNLS", "DEP"
]

def fetch_data(tier_name, asset_filter):
    """Fetch banks matching the specific asset tier filter."""
    print(f"Fetching data for tier: {tier_name}...")
    base_url = "https://banks.data.fdic.gov/api/financials"
    fields = "CERT,REPDTE,ASSET,NUMEMP,INTINC,INTEXP,EINTEXP,NONII,NONIX,LNLSNET,NETINC,EQ,NCLNLS"

    # Require ASSET > 0, dates from 2024 onwards, and the specific tier filter
    filters = f'ASSET:>0 AND REPDTE:[20240101 TO *] AND {asset_filter}'

    encoded_filters = requests.utils.quote(filters)
    url = f"{base_url}?filters={encoded_filters}&fields={fields}&limit={CONFIG['limit']}&sort_by=REPDTE&sort_order=DESC&format=json"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        records = [item['data'] for item in data.get('data', [])]
        print(f"  ...fetched {len(records)} records for {tier_name}.")
        return records
    except Exception as e:
        print(f"Error fetching data for {tier_name}: {e}")
        return []

def clean_data(raw_data):
    """Converts raw data to DataFrame and handles initial cleaning."""
    df = pd.DataFrame(raw_data)
    # Convert relevant columns to numeric, coercing errors to NaN
    numeric_cols = [
        "ASSET", "NONIX", "NONII", "INTEXP", "EINTEXP",
        "INTINC", "LNLSNET", "NUMEMP", "NETINC", "EQ", "NCLNLS"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        else:
            df[col] = 0 # Add missing columns as 0

    # Fill any remaining NaNs with 0 for calculation purposes
    df = df.fillna(0)
    return df

def compute_kpis(df):
    """Calculate the standardized KPIs matching the frontend logic."""
    # KPIs based on kpiCalculator.js logic

    # Safe division helper
    def safe_div(n, d):
        return np.where(d > 0, n / d, 0)

    # Base components
    non_interest_exp = df['NONIX']
    non_interest_inc = df['NONII']
    interest_exp = df['INTEXP'] + df['EINTEXP'] # Handle both potential fields
    interest_inc = df['INTINC']
    net_interest_inc = interest_inc - interest_exp
    total_assets = df['ASSET']
    total_loans = df['LNLSNET']
    total_income = net_interest_inc + non_interest_inc
    net_income = df['NETINC']

    # Calculated KPIs (in standard units matching UI, e.g., 65.0 for 65%)
    df['efficiencyRatio'] = safe_div(non_interest_exp, total_income) * 100
    df['costOfFunds'] = safe_div(interest_exp, total_assets) * 100
    df['nonInterestIncomePercent'] = safe_div(non_interest_inc, total_income) * 100
    df['yieldOnLoans'] = safe_div(interest_inc, total_loans) * 100
    df['returnOnAssets'] = safe_div(net_income, total_assets) * 100
    df['netInterestMargin'] = safe_div(net_interest_inc, total_assets) * 100
    df['nptlRatio'] = safe_div(df['NCLNLS'], total_loans) * 100

    # Clean up infinities or massive outliers from dividing by tiny numbers
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df = df.dropna()
    
    # Crucial Fix: 'costOfFunds' is both a feature and a target. 
    # If it accidentally gets created twice in upstream aggregation, 
    # X[['costOfFunds']] returns a DataFrame with 2 columns, breaking lsq_linear.
    df = df.loc[:, ~df.columns.duplicated()]

    return df

def train_and_export(df, features, targets):
    """
    Train strictly constrained Ridge-equivalent models on the supplied dataframe.
    Returns the tier-specific artifact dictionary.
    """
    print("Training models...")

    if len(df) == 0:
        print("Error: No data to train on.")
        return {}

    # Ensure no column duplication exists in df BEFORE subsetting
    df = df.loc[:, ~df.columns.duplicated()]

    # Force exact 4 features
    # (If 'costOfFunds' was in features twice, list(set) would fix, but it's not)
    X = df[features].copy()

    # 1. Calculate Scalers for all features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 2. Define Banking Logic Constraints (Bounds) and Feature Maps
    # We must explicitly map which levers actually drive which targets.
    # Otherwise, statistical noise in the FDIC cross-sectional data will invent
    # relationships that violate basic banking math (e.g. NII driving Cost of Funds).
    target_logic = {
        "returnOnAssets": {
            # ROA is the bottom line, it is driven by everything.
            "active_features": ["efficiencyRatio", "nonInterestIncomePercent", "yieldOnLoans", "costOfFunds"],
            "lower": [-np.inf, 0, 0, -np.inf], # NII and Yield impact ROA positively
            "upper": [0, np.inf, np.inf, 0]    # Eff Ratio and CoF impact ROA negatively
        },
        "costOfFunds": {
            # Fix target leakage: CoF cannot be used to predict CoF!
            # We must use other levers (like Yield and Efficiency) to find the relationships.
            "active_features": ["yieldOnLoans", "efficiencyRatio", "nonInterestIncomePercent"],
            "lower": [-np.inf, -np.inf, -np.inf],
            "upper": [np.inf, np.inf, np.inf]
        },
        "netInterestMargin": {
            # NIM is purely Interest Income vs Interest Expense.
            # Efficiency Ratio and NII have exactly ZERO mathematical impact.
            "active_features": ["yieldOnLoans", "costOfFunds"],
            "lower": [0, -np.inf],
            "upper": [np.inf, 0]
        },
        "nptlRatio": {
            # Asset quality/NPLs in this simplified model.
            # Usually driven by macro, but we'll let it correlate with yield (riskier loans = higher yield).
            "active_features": ["yieldOnLoans"],
            "lower": [-np.inf],
            "upper": [np.inf]
        }
    }

    target_models = {}
    for target in targets:
        y = np.array(df[target]).ravel()  # Force 1D array to guarantee lsq_linear compatibility
        logic = target_logic.get(target, {
            "active_features": features, # Fallback to all
            "lower": [-np.inf]*len(features),
            "upper": [np.inf]*len(features)
        })
        
        active_feats = logic["active_features"]
        
        # Build bounds strictly aligned with active_feats length
        lb_list = logic["lower"]
        ub_list = logic["upper"]
        if len(lb_list) != len(active_feats):
            print(f"Warning: Bounds length mismatch for {target}. Fixing...")
            lb_list = [-np.inf]*len(active_feats)
            ub_list = [np.inf]*len(active_feats)
            
        bounds = (np.array(lb_list), np.array(ub_list))

        # Build a scaled X matrix ONLY for the active features
        X_active = X[active_feats]
        scaler_active = StandardScaler()
        X_active_scaled = scaler_active.fit_transform(X_active)

        # Fit LSQ Linear on the subset of active features
        # Ensure X_active_scaled shape matches bounds
        res = lsq_linear(X_active_scaled, y, bounds=bounds)

        active_unscaled_coefs = res.x / scaler_active.scale_
        unscaled_intercept = np.mean(y) - np.sum(active_unscaled_coefs * scaler_active.mean_)

        # Calculate RMSE on the active subset
        preds = np.dot(X_active, active_unscaled_coefs) + unscaled_intercept
        rmse = root_mean_squared_error(y, preds)

        # Pad the final coefficient array so it matches the global 'features' list order
        # This ensures the React frontend doesn't need to change its indexing logic.
        final_coefs = []
        for feat in features:
            if feat in active_feats:
                idx = active_feats.index(feat)
                final_coefs.append(active_unscaled_coefs[idx])
            else:
                final_coefs.append(0.0) # Unrelated feature has 0 impact

        target_models[target] = {
            "coef": final_coefs,
            "intercept": float(unscaled_intercept),
            "rmse": float(rmse)
        }

    # 3. Calculate Operational Tradeoffs (Covariance/Correlation)
    # The tradeoff matrix tells the UI how levers historically move together.
    # We use correlation, scaled by standard deviation, to project realistic secondary impacts.
    correlation_matrix = df[features].corr()

    tradeoffs = {}
    for primary_lever in features:
        tradeoffs[primary_lever] = {}
        for secondary_lever in features:
            if primary_lever != secondary_lever:
                # beta_tradeoff: "For every 1 unit move in primary, secondary moves by X"
                # beta = corr(x,y) * (std(y) / std(x))
                corr = correlation_matrix.loc[primary_lever, secondary_lever]
                std_primary = df[primary_lever].std()
                std_secondary = df[secondary_lever].std()

                if std_primary > 0:
                    tradeoff_beta = corr * (std_secondary / std_primary)
                    tradeoffs[primary_lever][secondary_lever] = float(tradeoff_beta)
                else:
                    tradeoffs[primary_lever][secondary_lever] = 0.0

    # 4. Confidence Bounds (V2/V3)
    # Give the UI statistical boundaries so it knows when a user's slider
    # input is entering "low confidence" (anomaly) territory.
    confidence_metrics = {}
    for feature in features:
        mean_val = df[feature].mean()
        std_val = df[feature].std()
        confidence_metrics[feature] = {
            "mean": float(mean_val),
            "std": float(std_val),
            "p10": float(df[feature].quantile(0.10)),
            "p90": float(df[feature].quantile(0.90))
        }

    return {
        "n_banks": df['CERT'].nunique() if 'CERT' in df.columns else len(df),
        "n_rows": len(df),
        "features": features,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist()
        },
        "targets": target_models,
        "tradeoffs": tradeoffs,
        "confidence_metrics": confidence_metrics
    }

def main():
    print("Starting BankValue Offline Training Pipeline V3 (Tiered Models)")

    master_artifact = {
        "schema_version": "3.0",
        "trained_on": {
            "asof": datetime.now().isoformat(),
        },
        "tiers": {}
    }

    for tier_name, asset_filter in CONFIG["tiers"].items():
        # 1. Fetch, Clean, Calculate KPIs
        raw_data = fetch_data(tier_name, asset_filter)
        if not raw_data:
            print(f"Skipping tier {tier_name} due to lack of data.")
            continue

        df = clean_data(raw_data)
        if df.empty:
            print(f"Skipping tier {tier_name} due to empty dataframe after cleaning.")
            continue

        df = compute_kpis(df)

        # Drop rows with NaNs or infs in required columns
        req_cols = CONFIG["features"] + CONFIG["targets"]
        df = df[req_cols].replace([np.inf, -np.inf], np.nan).dropna()

        if len(df) < 50:
            print(f"Not enough clean records to train {tier_name} model (N={len(df)}).")
            continue

        print(f"\nTraining V3 Model for {tier_name}. N={len(df)}")
        tier_artifact = train_and_export(df, CONFIG["features"], CONFIG["targets"])
        master_artifact["tiers"][tier_name] = tier_artifact

    # Export the consolidated V3 artifact
    export_path = "../../public/models/whatwouldittake_tiered.json"
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    with open(export_path, 'w') as f:
        json.dump(master_artifact, f, indent=2)

    print(f"\nPipeline execution finished. V3 models exported to {export_path}")

if __name__ == "__main__":
    main()

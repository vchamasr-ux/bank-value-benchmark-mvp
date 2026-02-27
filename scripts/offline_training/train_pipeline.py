import os
import sys
import pandas as pd
import numpy as np
import requests
import json
from datetime import datetime
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import root_mean_squared_error

# Configuration
CONFIG = {
    "api_batch_size": 1000,
    "quarters_to_fetch": ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"], 
    "targets": ["returnOnAssets", "costOfFunds"],
    "features": ["efficiencyRatio", "nonInterestIncomePercent", "yieldOnLoans", "costOfFunds"],
    "output_file": "../../public/models/whatwouldittake_v1.json"
}

# The FDIC variables we need to calculate our KPIs
FDIC_VARS = [
    "CERT", "REPDTE", "ASSET", "NONIX", "NONII", "INTEXP", "EINTEXP", 
    "INTINC", "LNLSNET", "NUMEMP", "NETINC", "EQ", "NCLNLS", "DEP"
]

def fetch_fdic_data(quarter):
    """Fetch raw FDIC data for a specific quarter via pagination."""
    print(f"Fetching data for {quarter}...")
    
    base_url = "https://banks.data.fdic.gov/api/financials"
    fields = ",".join(FDIC_VARS)
    
    # We want commercial banks and savings institutions
    filters = f"REPDTE:{quarter.replace('-', '')} AND CB:1 AND STALP:*"
    
    all_records = []
    offset = 0
    limit = CONFIG["api_batch_size"]
    
    while True:
        params = {
            "filters": filters,
            "fields": fields,
            "limit": limit,
            "offset": offset,
            "format": "json"
        }
        
        try:
            response = requests.get(base_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            records = [item["data"] for item in data.get("data", [])]
            all_records.extend(records)
            
            if len(records) < limit:
                break # Reached the end
            
            offset += limit
            print(f"  ...fetched {len(all_records)} records so far...")
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data for {quarter}: {e}")
            break
            
    print(f"Completed {quarter}: {len(all_records)} total records.")
    return all_records

def build_historical_panel():
    """Fetch and concatenate all required quarters into a single DataFrame."""
    print("Building historical panel...")
    all_data = []
    for q in CONFIG["quarters_to_fetch"]:
        quarter_data = fetch_fdic_data(q)
        all_data.extend(quarter_data)
        
    df = pd.DataFrame(all_data)
    print(f"Final Panel Shape: {df.shape}")
    return df

def calculate_kpis(df):
    """Calculate the standardized KPIs matching the frontend logic."""
    print("Calculating standardized KPIs...")
    # 0. Ensure all required columns exist
    for var in FDIC_VARS:
        if var not in df.columns:
            df[var] = 0

    # 1. Handle missing/null values
    df = df.fillna(0)
    
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
    num_employees = df['NUMEMP']
    net_income = df['NETINC']
    
    # Calculated KPIs (in standard units matching UI, e.g., 65.0 for 65%)
    df['efficiencyRatio'] = safe_div(non_interest_exp, total_income) * 100
    df['costOfFunds'] = safe_div(interest_exp, total_assets) * 100
    df['nonInterestIncomePercent'] = safe_div(non_interest_inc, total_income) * 100
    df['yieldOnLoans'] = safe_div(interest_inc, total_loans) * 100
    df['returnOnAssets'] = safe_div(net_income, total_assets) * 100
    
    # Clean up infinities or massive outliers from dividing by tiny numbers
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df = df.dropna()
    
    return df

def train_and_export(df):
    """Train Ridge models and export the JSON artifact."""
    print("Training models...")
    
    if len(df) == 0:
        print("Error: No data to train on.")
        return
        
    features = CONFIG["features"]
    targets = CONFIG["targets"]
    
    # 1. Calculate Scalers
    scaler = StandardScaler()
    X = df[features]
    scaler.fit(X)
    
    # 2. Train target models
    target_models = {}
    for target in targets:
        y = df[target]
        
        # Ridge regression to handle multicollinearity and prevent extreme coefficients
        model = Ridge(alpha=1.0)
        
        # We fit on UN-SCALED features so the coefficients are directly interpretable
        # against the raw KPI values inputted by the user (makes JS math easier).
        model.fit(X, y)
        preds = model.predict(X)
        rmse = root_mean_squared_error(y, preds)
        
        target_models[target] = {
            "coef": model.coef_.tolist(),
            "intercept": float(model.intercept_),
            "rmse": float(rmse)
        }
        
    # 3. Calculate Empirical Bounds (1st and 99th percentiles of historical 4q movement)
    # Note: Proper 4q bounds require sorting by CERT and calculating diffs over 4 quarters.
    # For V1 scaffolding, we simulate empirical variance limits based on cross-sectional std.
    bounds = {}
    for feat in features:
        std_dev = float(df[feat].std())
        bounds[feat] = {
            "min": -std_dev * 1.5,  # Max allowable decrease (1.5 standard deviations)
            "max": std_dev * 1.5    # Max allowable increase
        }

    # 4. Construct Artifact
    artifact = {
        "schema_version": "1.0",
        "trained_on": {
            "asof": datetime.now().strftime("%Y-%m-%d"),
            "quarters": CONFIG["quarters_to_fetch"],
            "n_banks": len(df["CERT"].unique()) if "CERT" in df else 0,
            "n_rows": len(df)
        },
        "features": features,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "std": scaler.scale_.tolist()
        },
        "targets": target_models,
        "lever_bounds": {
            "4q": bounds
        },
        "notes": {
            "units": "Levers are in standard KPI units (%, etc). Coefficients map unscaled features to the target."
        }
    }
    
    # 5. Export
    os.makedirs(os.path.dirname(CONFIG["output_file"]), exist_ok=True)
    with open(CONFIG["output_file"], "w") as f:
        json.dump(artifact, f, indent=4)
        
    print(f"Artifact exported successfully to {CONFIG['output_file']}")

if __name__ == "__main__":
    print("Starting BankValue Offline Training Pipeline...")
    df = build_historical_panel()
    if not df.empty:
        df_kpi = calculate_kpis(df)
        train_and_export(df_kpi)
    print("Pipeline execution finished.")

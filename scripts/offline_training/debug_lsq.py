import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from scipy.optimize import lsq_linear
from train_pipeline import fetch_data, clean_data, compute_kpis

# The FDIC tier filter for Community Banks, avoiding the < character for safety in bash
df = clean_data(fetch_data('Community', 'ASSET:[1000000 TO 10000000]'))
df = compute_kpis(df)
df = df.loc[:, ~df.columns.duplicated()]

features = ['efficiencyRatio', 'nonInterestIncomePercent', 'yieldOnLoans', 'costOfFunds']
targets = ['returnOnAssets', 'costOfFunds', 'netInterestMargin', 'nptlRatio']

target_logic = {
    "returnOnAssets": {
        "active_features": ["efficiencyRatio", "nonInterestIncomePercent", "yieldOnLoans", "costOfFunds"],
        "lower": [-np.inf, 0, 0, -np.inf],
        "upper": [0, np.inf, np.inf, 0]
    },
    "costOfFunds": {
        "active_features": ["costOfFunds"],
        "lower": [0],
        "upper": [np.inf]
    },
    "netInterestMargin": {
        "active_features": ["yieldOnLoans", "costOfFunds"],
        "lower": [0, -np.inf],
        "upper": [np.inf, 0]
    },
    "nptlRatio": {
        "active_features": ["yieldOnLoans"],
        "lower": [-np.inf],
        "upper": [np.inf]
    }
}

for target in targets:
    print(f"\n--- Testing {target} ---")
    y = df[target]
    logic = target_logic.get(target, {
        "active_features": features,
        "lower": [-np.inf]*len(features),
        "upper": [np.inf]*len(features)
    })
    
    active_feats = logic["active_features"]
    lb_list = logic["lower"]
    ub_list = logic["upper"]
    
    if len(lb_list) != len(active_feats):
        lb_list = [-np.inf]*len(active_feats)
        ub_list = [np.inf]*len(active_feats)
        
    bounds = (np.array(lb_list, dtype=float), np.array(ub_list, dtype=float))
    
    X_active = df[active_feats]
    scaler_active = StandardScaler()
    X_active_scaled = scaler_active.fit_transform(X_active)
    
    print(f"X shape: {X_active_scaled.shape}")
    print(f"y shape: {y.shape}")
    print(f"bounds 0 shape: {bounds[0].shape}, bounds 1 shape: {bounds[1].shape}")
    
    try:
        res = lsq_linear(X_active_scaled, y, bounds=bounds)
        print("Success!")
    except Exception as e:
        print(f"FAIL: {e}")


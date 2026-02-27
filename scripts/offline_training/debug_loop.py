from train_pipeline import *
df = clean_data(fetch_data('<$1B', CONFIG['tiers']['<$1B']))
df = compute_kpis(df)
df = df.loc[:, ~df.columns.duplicated()]

features = CONFIG["features"]
targets = CONFIG["targets"]
X = df[features]

for target in targets:
    print(f"\n--- Target: {target} ---")
    active_feats = ["efficiencyRatio", "nonInterestIncomePercent", "yieldOnLoans", "costOfFunds"]
    X_active = X[active_feats]
    scaler_active = StandardScaler()
    X_active_scaled = scaler_active.fit_transform(X_active)
    print("X[active_feats].shape:", X_active.shape)
    print("X_active_scaled.shape:", X_active_scaled.shape)

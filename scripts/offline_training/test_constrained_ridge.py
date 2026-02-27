import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from scipy.optimize import lsq_linear

np.random.seed(42)
n = 1000
assets = np.random.uniform(100, 1000, n)
loans = assets * np.random.uniform(0.5, 0.9, n)
loan_rate = np.random.uniform(0.04, 0.10, n)
cof_rate = loan_rate - np.random.uniform(0.02, 0.04, n)

interest_inc = loans * loan_rate
interest_exp = assets * cof_rate
net_interest_inc = interest_inc - interest_exp

df = pd.DataFrame()
df['yieldOnLoans'] = (interest_inc / loans) * 100
df['costOfFunds'] = (interest_exp / assets) * 100
df['efficiencyRatio'] = np.random.uniform(40, 80, n)
df['nonInterestIncomePercent'] = np.random.uniform(5, 20, n)
df['netInterestMargin'] = (net_interest_inc / assets) * 100

# NEW STRATEGY: Explicit Feature Mapping Per Target
feature_map = {
    # ROA depends on everything
    "returnOnAssets": ['efficiencyRatio', 'nonInterestIncomePercent', 'yieldOnLoans', 'costOfFunds'],
    
    # Cost of funds should ONLY really be affected by itself (or macro factors we don't have)
    # But for the sake of the inverse engine, we'll keep it simple
    "costOfFunds": ['costOfFunds'],
    
    # Net Interest Margin is strictly a function of Yield and Cost of Funds!
    # Efficiency ratio and non-interest income have ZERO mathematical impact on it.
    "netInterestMargin": ['yieldOnLoans', 'costOfFunds']
}

target = "netInterestMargin"
features = feature_map[target]

X = df[features]
y = df[target]

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Define bounds ONLY for the active features
# Yield >= 0, CoF <= 0
bounds = ([0, -np.inf], [np.inf, 0])

res = lsq_linear(X_scaled, y, bounds=bounds)

unscaled_coefs = res.x / scaler.scale_
print(f"Constrained Coefs for {target}:")
for f, c in zip(features, unscaled_coefs):
    print(f"  {f}: {c:.6f}")

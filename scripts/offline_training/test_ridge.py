import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.preprocessing import StandardScaler

# Generate dummy bank data based on the formulas
np.random.seed(42)
n = 1000
assets = np.random.uniform(100, 1000, n)
loans = assets * np.random.uniform(0.5, 0.9, n)

# Rates
loan_rate = np.random.uniform(0.04, 0.10, n)
cof_rate = loan_rate - np.random.uniform(0.02, 0.04, n) # CoF is highly correlated with loan rate!

interest_inc = loans * loan_rate
interest_exp = assets * cof_rate
net_interest_inc = interest_inc - interest_exp

# Features
df = pd.DataFrame()
df['yieldOnLoans'] = (interest_inc / loans) * 100
df['costOfFunds'] = (interest_exp / assets) * 100
df['efficiencyRatio'] = np.random.uniform(40, 80, n)
df['nonInterestIncomePercent'] = np.random.uniform(5, 20, n)

# Target
df['netInterestMargin'] = (net_interest_inc / assets) * 100

features = ['efficiencyRatio', 'nonInterestIncomePercent', 'yieldOnLoans', 'costOfFunds']
X = df[features]
y = df['netInterestMargin']

# 1. Unscaled Ridge (What we have now)
model1 = Ridge(alpha=1.0)
model1.fit(X, y)
print("Unscaled Ridge Coefs:")
for f, c in zip(features, model1.coef_):
    print(f"  {f}: {c:.4f}")

# 2. Linear Regression (OLS)
model2 = LinearRegression()
model2.fit(X, y)
print("\nOLS Coefs:")
for f, c in zip(features, model2.coef_):
    print(f"  {f}: {c:.4f}")

# 3. Scaled Ridge -> Unscaled Coefs
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
model3 = Ridge(alpha=1.0)
model3.fit(X_scaled, y)
# Unscale coefs: beta_unscaled = beta_scaled / std(X)
unscaled_coefs = model3.coef_ / scaler.scale_
print("\nProper Scaled Ridge (Unscaled for front-end):")
for f, c in zip(features, unscaled_coefs):
    print(f"  {f}: {c:.4f}")

# 4. Adding Loan/Asset ratio as a feature (The missing variable!)
df['loanToAssetRatio'] = (loans / assets) * 100
features4 = ['efficiencyRatio', 'nonInterestIncomePercent', 'yieldOnLoans', 'costOfFunds', 'loanToAssetRatio']
X4 = df[features4]
model4 = LinearRegression()
model4.fit(X4, y)
print("\nOLS With LoanToAssetRatio:")
for f, c in zip(features4, model4.coef_):
    print(f"  {f}: {c:.4f}")

from train_pipeline import *
df = clean_data(fetch_data('<$1B', CONFIG['tiers']['<$1B']))
df = compute_kpis(df)
print("ALL COLS:", df.columns.tolist())
df = df.loc[:, ~df.columns.duplicated()]
print("DEDUP COLS:", df.columns.tolist())
print(df[CONFIG['features']].shape)

# Offline Model Training Pipeline

## Goal
To build a Python-based data ingestion and model training pipeline. This pipeline will pull historical bank data from the FDIC API, process it to match the KPI metrics used in the frontend, train regularized regression models (Ridge) for specified targets, and export a static JSON model artifact (`whatwouldittake_v1.json`).

## Architecture
1.  **`download_data.py`**: Interacts with the FDIC API to download a historical panel of bank data for a specified number of quarters.
2.  **`prep_data.py`**: Cleans the raw FDIC data and computes the specific KPIs (Return on Assets, Cost of Funds, Efficiency Ratio, Non-Interest Income %, Yield on Loans) in the exact format and scale as the UI's `kpiCalculator.js`.
3.  **`train_model.py`**: Trains Ridge regression models for the target variables, computes necessary scalers and empirical bounds, and exports the `model.json` artifact.

## Steps
1. Define the data dictionary mapping FDIC variables to our required variables.
2. Write the API extraction script.
3. Write the data transformation and KPI calculation logic (must be mathematically identical to the frontend `kpiCalculator.js`).
4. Write the training loop and JSON generation logic.
5. Create a `run_pipeline.sh` (or `.bat`) wrapper to execute the pipeline end-to-end.

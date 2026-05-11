#!/usr/bin/env python3
"""
Train a battery drain prediction model on the extracted dataset and validate
it with leave-one-out cross-validation (appropriate for small datasets).

Usage:
    python3 train.py --dataset dataset.csv --model-output battery_model.pkl
"""

import argparse
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import LeaveOneOut
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "bot_type",
    "duration_s",
    "motor_energy_proxy",
    "num_dives",
    "total_depth_m",
    "starting_battery_pct",
]
TARGET = "battery_drain_pct"


def load_dataset(csv_path: str) -> tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    df = pd.read_csv(csv_path)

    missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing columns: {missing}")

    # Drop rows where any feature or target is missing
    df = df.dropna(subset=FEATURES + [TARGET])
    print(f"Dataset: {len(df)} usable rows after dropping NaNs")

    X = df[FEATURES].values.astype(float)
    y = df[TARGET].values.astype(float)
    return X, y, df


def evaluate_loo(model_cls, X: np.ndarray, y: np.ndarray, df: pd.DataFrame) -> tuple[float, float]:
    """Leave-one-out cross-validation. Returns (MAE, RMSE)."""
    loo = LeaveOneOut()
    predictions = np.zeros(len(y))

    for train_idx, test_idx in loo.split(X):
        m = model_cls()
        m.fit(X[train_idx], y[train_idx])
        predictions[test_idx] = m.predict(X[test_idx])

    mae = mean_absolute_error(y, predictions)
    rmse = root_mean_squared_error(y, predictions)

    print("\nLeave-one-out predictions:")
    print(f"  {'Log':<45} {'Actual':>7} {'Predicted':>10} {'Error':>7}")
    print(f"  {'-'*45} {'-'*7} {'-'*10} {'-'*7}")
    for i, (actual, pred) in enumerate(zip(y, predictions)):
        log = df.iloc[i]["log_file"] if "log_file" in df.columns else str(i)
        error = pred - actual
        print(f"  {log:<45} {actual:>6.1f}% {pred:>9.1f}% {error:>+6.1f}%")

    return mae, rmse


def make_pipeline(model):
    return Pipeline([("scaler", StandardScaler()), ("model", model)])


def main():
    parser = argparse.ArgumentParser(description="Train battery drain prediction model")
    parser.add_argument("--dataset", required=True, help="Input CSV from extract_features.py")
    parser.add_argument("--model-output", required=True, help="Output .pkl path for trained model")
    args = parser.parse_args()

    X, y, df = load_dataset(args.dataset)

    print(f"\nFeatures: {FEATURES}")
    print(f"Target:   {TARGET}")
    print(f"\nTarget stats: mean={y.mean():.1f}%  std={y.std():.1f}%  "
          f"min={y.min():.1f}%  max={y.max():.1f}%")

    # ── Compare models with LOO CV ────────────────────────────────────────────
    models = {
        "OLS":           lambda: make_pipeline(LinearRegression()),
        "Ridge":         lambda: make_pipeline(Ridge(alpha=1.0)),
        "Random forest": lambda: make_pipeline(RandomForestRegressor(n_estimators=100, max_depth=4, random_state=42)),
        "MLP (8,4)":     lambda: make_pipeline(MLPRegressor(hidden_layer_sizes=(8, 4), alpha=0.1, max_iter=2000, random_state=42)),
    }

    best_name, best_mae = None, float("inf")
    for name, model_cls in models.items():
        print(f"\n{'='*60}")
        print(f"Model: {name}")
        mae, rmse = evaluate_loo(model_cls, X, y, df)
        print(f"\n  MAE:  {mae:.2f}%   RMSE: {rmse:.2f}%")
        if mae < best_mae:
            best_mae, best_name = mae, name

    # ── Train final model on all data ─────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Best model: {best_name} (LOO MAE = {best_mae:.2f}%)")
    print(f"Training final model on all {len(X)} samples ...")

    final_model = models[best_name]()
    final_model.fit(X, y)

    with open(args.model_output, "wb") as f:
        pickle.dump({"model": final_model, "features": FEATURES, "target": TARGET}, f)

    print(f"Saved model to {args.model_output}")

    # ── Feature importances (if random forest) ────────────────────────────────
    inner = final_model.named_steps["model"]
    if hasattr(inner, "feature_importances_"):
        print("\nFeature importances:")
        for feat, imp in sorted(zip(FEATURES, inner.feature_importances_), key=lambda x: -x[1]):
            print(f"  {feat:<30} {imp:.3f}")


if __name__ == "__main__":
    main()

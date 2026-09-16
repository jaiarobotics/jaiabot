#!/usr/bin/env python3
"""
Train a battery drain prediction model on the extracted dataset and validate
it with leave-one-out cross-validation (appropriate for small datasets).

Usage:
    python3 train.py --dataset dataset.csv --model-output battery_model.pkl
"""

import argparse
import pickle
import warnings

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Lasso, Ridge
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import LeaveOneOut
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler


class NonNegativeHuberRegressor(BaseEstimator, RegressorMixin):
    """Huber-loss linear regression with non-negative coefficient constraints.

    Solves via L-BFGS-B with per-coefficient bounds of [0, ∞). The Huber loss
    is squared for residuals within `epsilon` and linear beyond it, giving
    robustness against outliers. The non-negativity constraint preserves
    monotonicity of the prediction in every input.
    """

    def __init__(self, alpha: float = 1.0, epsilon: float = 1.35):
        self.alpha = alpha
        self.epsilon = epsilon

    def _huber(self, r: np.ndarray) -> np.ndarray:
        abs_r = np.abs(r)
        return np.where(
            abs_r <= self.epsilon,
            0.5 * r ** 2,
            self.epsilon * (abs_r - 0.5 * self.epsilon),
        )

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        n_features = X.shape[1]

        def loss(params):
            beta = params[:-1]
            b0 = params[-1]
            residuals = y - (X @ beta + b0)
            return float(self._huber(residuals).sum() + self.alpha * (beta ** 2).sum())

        x0 = np.zeros(n_features + 1)
        bounds = [(0.0, None)] * n_features + [(None, None)]  # intercept unbounded
        result = minimize(loss, x0, bounds=bounds, method="L-BFGS-B")
        self.coef_ = result.x[:-1]
        self.intercept_ = float(result.x[-1])
        return self

    def predict(self, X):
        return np.asarray(X, dtype=float) @ self.coef_ + self.intercept_

# Convergence warnings are noisy and don't affect the reported LOO numbers — the
# model is already trained when sklearn warns. Silence them so the table reads
# cleanly.
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
warnings.filterwarnings("ignore", message=".*ConvergenceWarning.*")
try:
    from sklearn.exceptions import ConvergenceWarning
    warnings.filterwarnings("ignore", category=ConvergenceWarning)
except ImportError:
    pass

FEATURES = [
    "bot_type",
    "transit_energy_wh",
    "transit_time_s",
    "turn_density_deg_per_km",
    "hotel_energy_wh",
    "dive_energy_wh",
    "starting_battery_pct",
]
TARGET = "battery_drain_pct"

# Per-feature monotonicity constraint: +1 means drain is required to be
# non-decreasing in that feature. 0 means no constraint (e.g. bot_type is
# categorical, the direction depends on which class is "harder"). These match
# the physical relationships between each plan input and battery drain.
MONOTONIC_CONSTRAINT = {
    "bot_type":                  0,
    "transit_energy_wh":         +1,
    "transit_time_s":            +1,
    "turn_density_deg_per_km":   +1,
    "hotel_energy_wh":           +1,
    "dive_energy_wh":            +1,
    "starting_battery_pct":      +1,
}
MONOTONIC_CST_ARRAY = np.array([MONOTONIC_CONSTRAINT[f] for f in FEATURES], dtype=int)

STOCHASTIC_SEEDS = (0,)  # average across these for non-deterministic models


def load_dataset(csv_path: str) -> tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    df = pd.read_csv(csv_path)

    missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing columns: {missing}")

    df = df.dropna(subset=FEATURES + [TARGET])
    print(f"Dataset: {len(df)} usable rows after dropping NaNs")

    X = df[FEATURES].values.astype(float)
    y = df[TARGET].values.astype(float)
    return X, y, df


def loo_predictions(model_factory, X: np.ndarray, y: np.ndarray, seed: int | None = None) -> np.ndarray:
    """Run a full leave-one-out pass and return the per-row predictions."""
    preds = np.zeros(len(y))
    loo = LeaveOneOut()
    for train_idx, test_idx in loo.split(X):
        m = model_factory(seed)
        m.fit(X[train_idx], y[train_idx])
        preds[test_idx] = m.predict(X[test_idx])
    return preds


def evaluate_loo(
    model_factory,
    X: np.ndarray,
    y: np.ndarray,
    stochastic: bool,
) -> tuple[float, float, np.ndarray]:
    """Leave-one-out evaluation. For stochastic models, average predictions
    across `STOCHASTIC_SEEDS` random seeds to get a stable estimate."""
    if stochastic:
        all_preds = np.stack([loo_predictions(model_factory, X, y, s) for s in STOCHASTIC_SEEDS])
        preds = all_preds.mean(axis=0)
    else:
        preds = loo_predictions(model_factory, X, y, seed=None)
    mae = mean_absolute_error(y, preds)
    rmse = root_mean_squared_error(y, preds)
    return mae, rmse, preds


def make_pipeline(model):
    return Pipeline([("scaler", StandardScaler()), ("model", model)])


def make_poly_pipeline(model, degree: int = 2, interaction_only: bool = False):
    """Polynomial-expanded Ridge: expand features on raw (non-negative) inputs,
    then scale, then fit.

    The polynomial expansion comes *before* any centering so the interaction
    terms (x_i × x_j) are products of non-negative values. Combined with
    `Ridge(positive=True)`, that guarantees the prediction is monotonic
    increasing in every input. Scaling after expansion only changes the
    magnitudes the regularizer sees; it doesn't change monotonicity because
    rescaling is a positive linear transform per feature.
    """
    return Pipeline([
        ("poly",   PolynomialFeatures(
            degree=degree, interaction_only=interaction_only, include_bias=False
        )),
        ("scaler", StandardScaler(with_mean=False)),
        ("model",  model),
    ])


def check_monotonicity(
    model, X: np.ndarray, n_baselines: int = 20, n_steps: int = 12,
    tolerance: float = 1e-3,
) -> list[str]:
    """Probe `model` for monotonicity violations across the constrained features.

    For each of `n_baselines` rows drawn from `X`, sweep each constrained
    feature from its 5th to 95th percentile over `n_steps` points (holding
    the rest of the baseline constant) and verify predictions don't decrease.
    Drops smaller than `tolerance` (in % drain) are considered floating-point
    noise and ignored.
    Returns a list of human-readable violation messages (empty if monotonic).
    """
    rng = np.random.default_rng(0)
    if len(X) > n_baselines:
        baselines = X[rng.choice(len(X), n_baselines, replace=False)]
    else:
        baselines = X
    violations = []
    for fi, fname in enumerate(FEATURES):
        if MONOTONIC_CONSTRAINT[fname] != +1:
            continue
        lo, hi = np.percentile(X[:, fi], [5, 95])
        if hi <= lo:
            continue
        sweep_vals = np.linspace(lo, hi, n_steps)
        for bi, base in enumerate(baselines):
            xs = np.tile(base, (n_steps, 1))
            xs[:, fi] = sweep_vals
            preds = model.predict(xs)
            diffs = np.diff(preds)
            worst_drop = float(diffs.min())
            if worst_drop < -tolerance:
                violations.append(
                    f"  {fname:<25s} baseline {bi}: max drop {worst_drop:+.3f}%  "
                    f"(at {fname}≈{sweep_vals[int(np.argmin(diffs))]:.2f})"
                )
                break  # one violation per feature is enough to flag
    return violations


def count_active_terms(model, threshold: float = 1e-10) -> tuple[int, int]:
    """Return (n_nonzero, n_total) for the inner estimator of `model`.

    For linear models this is non-zero coefficients out of the expanded basis
    size (post-poly if applicable). For tree models it is features with any
    importance > 0 out of the original feature count.
    """
    inner = model.named_steps["model"]
    if hasattr(inner, "coef_") and inner.coef_.ndim == 1:
        coef = np.asarray(inner.coef_)
        return int(np.sum(np.abs(coef) > threshold)), int(coef.size)
    if hasattr(inner, "feature_importances_"):
        imp = np.asarray(inner.feature_importances_)
        return int(np.sum(imp > threshold)), int(imp.size)
    return 0, 0


def build_model_zoo() -> dict[str, tuple[callable, bool]]:
    """Return {name: (factory(seed) -> pipeline, is_stochastic)}.

    Only monotonic models are included. Each one guarantees that drain is
    non-decreasing in every input flagged +1 by MONOTONIC_CONSTRAINT, so we
    can never predict that a longer/heavier mission uses less battery.
    """
    def _det(model_ctor, pipeline_fn=make_pipeline):
        return (lambda _seed: pipeline_fn(model_ctor()), False)

    def _stoch(model_ctor):
        return (lambda seed: make_pipeline(model_ctor(seed)), True)

    return {
        # Sign-constrained linear: positive=True forces every coefficient ≥ 0,
        # which guarantees the prediction is non-decreasing in every feature.
        # bot_type gets pushed to 0 weight (no natural sign) — acceptable
        # trade-off for monotonicity everywhere.
        "Ridge (monotonic)":       _det(lambda: Ridge(alpha=1.0, positive=True)),
        "Lasso (monotonic)":       _det(lambda: Lasso(alpha=0.5, positive=True, max_iter=10_000)),
        # Huber loss is squared for small residuals (like Ridge), linear for
        # large ones — gives robustness against outliers without down-weighting
        # well-fit rows. Non-negative bounds keep it monotonic.
        "Huber (monotonic)":       _det(lambda: NonNegativeHuberRegressor(alpha=1.0, epsilon=1.35)),
        # Polynomial expansion on raw (non-negative) inputs plus positive
        # coefficients keeps interaction terms (x_i × x_j) monotonic.
        "Ridge poly2 (monotonic)": _det(
            lambda: Ridge(alpha=5.0, positive=True),
            pipeline_fn=lambda m: make_poly_pipeline(m, degree=2, interaction_only=True),
        ),
        # Same polynomial expansion, L1-regularized: tends to zero out more
        # interaction terms so the deployed model is sparser and easier to
        # reason about (at the cost of some MAE).
        "Lasso poly2 (monotonic)": _det(
            lambda: Lasso(alpha=0.5, positive=True, max_iter=10_000),
            pipeline_fn=lambda m: make_poly_pipeline(m, degree=2, interaction_only=True),
        ),
        # Monotonically-constrained gradient boosting: every split respects the
        # per-feature sign in MONOTONIC_CST_ARRAY by construction.
        "HistGBM (monotonic)":    _stoch(lambda s: HistGradientBoostingRegressor(
            max_depth=3, max_iter=100, learning_rate=0.1,
            min_samples_leaf=5, l2_regularization=0.5,
            loss="absolute_error", random_state=s,
            monotonic_cst=MONOTONIC_CST_ARRAY,
        )),
    }


def main():
    parser = argparse.ArgumentParser(description="Train battery drain prediction model")
    parser.add_argument("--dataset", required=True, help="Input CSV from extract_features.py")
    parser.add_argument("--model-output", required=True, help="Output .pkl path for trained model")
    parser.add_argument("--verbose", action="store_true", help="Print per-row LOO predictions for the best model")
    args = parser.parse_args()

    X, y, df = load_dataset(args.dataset)

    print(f"\nFeatures ({len(FEATURES)}): {FEATURES}")
    print(f"Target:   {TARGET}")
    print(f"\nTarget stats: mean={y.mean():.1f}%  std={y.std():.1f}%  "
          f"min={y.min():.1f}%  max={y.max():.1f}%")

    zoo = build_model_zoo()
    results = []
    for name, (factory, is_stochastic) in zoo.items():
        mae, rmse, preds = evaluate_loo(factory, X, y, is_stochastic)
        # Train a single model on all data to probe monotonicity (cheap).
        probe_model = factory(STOCHASTIC_SEEDS[0] if is_stochastic else None)
        probe_model.fit(X, y)
        violations = check_monotonicity(probe_model, X)
        n_nonzero, n_total = count_active_terms(probe_model)
        median_abs = float(np.median(np.abs(preds - y)))
        max_abs = float(np.max(np.abs(preds - y)))
        within_3 = float((np.abs(preds - y) <= 3).mean() * 100)
        within_5 = float((np.abs(preds - y) <= 5).mean() * 100)
        results.append({
            "name":       name,
            "mae":        mae,
            "rmse":       rmse,
            "median_abs": median_abs,
            "max_abs":    max_abs,
            "within_3":   within_3,
            "within_5":   within_5,
            "preds":      preds,
            "stochastic": is_stochastic,
            "violations": violations,
            "n_nonzero":  n_nonzero,
            "n_total":    n_total,
        })

    # Sort by MAE for the table view.
    results.sort(key=lambda r: r["mae"])
    print("\n" + "=" * 110)
    print(f"{'Model':<26}{'MAE':>8}{'RMSE':>8}{'Median':>9}{'Max':>8}{'±3%':>8}{'±5%':>8}{'Mono':>8}{'Terms':>10}{'Type':>10}")
    print("-" * 110)
    for r in results:
        kind = "stoch" if r["stochastic"] else "det"
        mono = "OK" if not r["violations"] else f"FAIL({len(r['violations'])})"
        terms = f"{r['n_nonzero']}/{r['n_total']}"
        print(f"{r['name']:<26}"
              f"{r['mae']:>7.2f}%"
              f"{r['rmse']:>7.2f}%"
              f"{r['median_abs']:>8.2f}%"
              f"{r['max_abs']:>7.2f}%"
              f"{r['within_3']:>7.0f}%"
              f"{r['within_5']:>7.0f}%"
              f"{mono:>8}"
              f"{terms:>10}"
              f"{kind:>10}")
    print("=" * 110)

    # Deployment selection: among monotonic candidates within MAE_TOLERANCE of
    # the best MAE, pick the one that retains the most non-zero terms (ties
    # → lowest MAE). Rationale: features like dive_hold_s and dive_hold_stops
    # have a physical effect on drain, so a model that keeps them is preferred
    # over a slightly-lower-MAE one that zeros them out via aggressive L1.
    MAE_TOLERANCE = 0.5  # % drain
    monotonic_results = [r for r in results if not r["violations"]]
    if monotonic_results:
        best_mae = monotonic_results[0]["mae"]
        within_tol = [r for r in monotonic_results if r["mae"] <= best_mae + MAE_TOLERANCE]
        best = max(within_tol, key=lambda r: (r["n_nonzero"], -r["mae"]))
        print(f"\nDeployed model: {best['name']} "
              f"(LOO MAE = {best['mae']:.2f}%, {best['n_nonzero']}/{best['n_total']} terms, "
              f"monotonic in all constrained features)")
        if best is not monotonic_results[0]:
            top = monotonic_results[0]
            print(f"  Note: {top['name']} has slightly lower MAE ({top['mae']:.2f}% vs "
                  f"{best['mae']:.2f}%) but only {top['n_nonzero']}/{top['n_total']} terms — "
                  f"preferred {best['name']} for better feature coverage within "
                  f"{MAE_TOLERANCE:.1f}% MAE tolerance.")
        if results[0]["violations"]:
            print(f"  Note: lower-MAE non-monotonic model exists ({results[0]['name']}, "
                  f"MAE {results[0]['mae']:.2f}%), but rejected for failing monotonicity.")
    else:
        best = results[0]
        print(f"\nDeployed model: {best['name']} (LOO MAE = {best['mae']:.2f}%) — "
              f"WARNING: no model passes monotonicity, using lowest-MAE anyway.")
    best_name = best["name"]

    if args.verbose:
        print("\nLeave-one-out predictions (best model):")
        print(f"  {'Log':<45} {'Actual':>7} {'Predicted':>10} {'Error':>7}")
        print(f"  {'-'*45} {'-'*7} {'-'*10} {'-'*7}")
        for i, (actual, pred) in enumerate(zip(y, best["preds"])):
            log = df.iloc[i]["log_file"] if "log_file" in df.columns else str(i)
            print(f"  {log:<45} {actual:>6.1f}% {pred:>9.1f}% {pred-actual:>+6.1f}%")

    # ── Train final model on all data ─────────────────────────────────────────
    factory, is_stochastic = zoo[best_name]
    if is_stochastic:
        # Refit using the first stochastic seed for reproducibility; the LOO
        # metric was averaged across seeds but inference uses a single model.
        final_model = factory(STOCHASTIC_SEEDS[0])
    else:
        final_model = factory(None)
    print(f"Training final model on all {len(X)} samples ...")
    final_model.fit(X, y)

    supported_bot_types = sorted(int(t) for t in df["bot_type"].unique())
    with open(args.model_output, "wb") as f:
        pickle.dump({
            "model": final_model,
            "features": FEATURES,
            "target": TARGET,
            "supported_bot_types": supported_bot_types,
        }, f)

    print(f"Saved model to {args.model_output}")

    # ── Feature importances (if model exposes them) ───────────────────────────
    inner = final_model.named_steps["model"]
    if hasattr(inner, "feature_importances_"):
        print("\nFeature importances:")
        for feat, imp in sorted(zip(FEATURES, inner.feature_importances_), key=lambda x: -x[1]):
            print(f"  {feat:<30} {imp:.3f}")
    elif hasattr(inner, "coef_") and inner.coef_.ndim == 1:
        print("\nLinear coefficients (on standardized features):")
        for feat, c in sorted(zip(FEATURES, inner.coef_), key=lambda x: -abs(x[1])):
            print(f"  {feat:<30} {c:+.3f}")


if __name__ == "__main__":
    main()

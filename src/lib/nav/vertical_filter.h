// Copyright 2025:
//   JaiaRobotics LLC
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_LIB_NAV_VERTICAL_FILTER_H
#define JAIABOT_LIB_NAV_VERTICAL_FILTER_H

#include <algorithm>
#include <cmath>

#include "jaiabot/nav/linalg.h"

namespace jaiabot
{
namespace nav
{
struct VerticalConfig
{
    /// Depth-rate random walk, m/s per sqrt(s).
    double rate_random_walk{0.25};
    /// Pressure-derived depth noise, m.
    double depth_noise{0.10};
    /// Innovation gate, in sigma.
    double gate_sigma{6.0};

    double initial_depth_sigma{5.0};
    double initial_rate_sigma{1.0};
    double max_propagation_step{0.5};
};

/// Constant-velocity filter over depth, driven by the pressure sensor.
/// Depth is positive down; rate is positive descending.
class VerticalFilter
{
  public:
    static constexpr std::size_t n_states = 2;
    static constexpr std::size_t i_depth = 0;
    static constexpr std::size_t i_rate = 1;

    using State = Vector<n_states>;
    using Covariance = Matrix<n_states, n_states>;

    explicit VerticalFilter(const VerticalConfig& config = {}) : cfg_(config)
    {
        P_ = Covariance::diagonal({cfg_.initial_depth_sigma * cfg_.initial_depth_sigma,
                                   cfg_.initial_rate_sigma * cfg_.initial_rate_sigma});
    }

    bool initialised() const { return initialised_; }
    double depth() const { return x_[i_depth]; }
    double depth_rate() const { return x_[i_rate]; }
    double depth_sigma() const { return std::sqrt(std::max(0.0, P_(i_depth, i_depth))); }
    const Covariance& covariance() const { return P_; }

    void propagate(double dt)
    {
        if (!initialised_ || !(dt > 0.0)) return;

        while (dt > 0.0)
        {
            const double step = std::min(dt, cfg_.max_propagation_step);
            x_[i_depth] += x_[i_rate] * step;

            Covariance F = Covariance::identity();
            F(i_depth, i_rate) = step;
            const double q = cfg_.rate_random_walk * cfg_.rate_random_walk * step;
            // Rate noise integrates into depth over the step.
            Covariance Q;
            Q(i_depth, i_depth) = q * step * step / 3.0;
            Q(i_depth, i_rate) = Q(i_rate, i_depth) = q * step / 2.0;
            Q(i_rate, i_rate) = q;

            P_ = (F * P_ * F.transpose() + Q).symmetrised();
            dt -= step;
        }
    }

    bool update_depth(double depth, double sigma)
    {
        if (!std::isfinite(depth) || !(sigma > 0.0)) return false;

        if (!initialised_)
        {
            x_[i_depth] = depth;
            x_[i_rate] = 0.0;
            P_(i_depth, i_depth) = sigma * sigma;
            initialised_ = true;
            return true;
        }

        Matrix<1, n_states> H;
        H(0, i_depth) = 1.0;

        const Matrix<1, 1> S = H * P_ * H.transpose() + Matrix<1, 1>::diagonal({sigma * sigma});
        if (!(S(0, 0) > 0.0)) return false;

        const double residual = depth - x_[i_depth];
        if (residual * residual > cfg_.gate_sigma * cfg_.gate_sigma * S(0, 0)) return false;

        const Matrix<n_states, 1> K = P_ * H.transpose() * (1.0 / S(0, 0));
        x_ += K * Matrix<1, 1>({residual});

        const Covariance IKH = Covariance::identity() - K * H;
        P_ = (IKH * P_ * IKH.transpose() +
              K * Matrix<1, 1>::diagonal({sigma * sigma}) * K.transpose())
                 .symmetrised();
        return true;
    }

    /// Default measurement noise from config, for callers without a per-sample estimate.
    double depth_noise() const { return cfg_.depth_noise; }

  private:
    VerticalConfig cfg_;
    State x_{};
    Covariance P_{};
    bool initialised_{false};
};

} // namespace nav
} // namespace jaiabot

#endif

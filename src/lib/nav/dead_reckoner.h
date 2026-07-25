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

#ifndef JAIABOT_LIB_NAV_DEAD_RECKONER_H
#define JAIABOT_LIB_NAV_DEAD_RECKONER_H

#include <algorithm>
#include <cmath>
#include <optional>

#include "jaiabot/nav/linalg.h"
#include "jaiabot/nav/quaternion.h"
#include "jaiabot/nav/thrust_model.h"

namespace jaiabot
{
namespace nav
{
/// Tuning for DeadReckoner. Position and velocity noise defaults come from measured fleet
/// GNSS behaviour, not from gpsd's reported accuracies, which are unusable.
struct DeadReckonerConfig
{
    /// Surge response time constant toward the thrust model's speed, s.
    double surge_time_constant{3.0};

    /// Process noise, all per sqrt(s) except where noted.
    double position_noise{0.05};
    double surge_noise{0.20};
    /// Current random walk. 0.013 lets the current move ~0.1 m/s over a minute.
    double current_random_walk{0.013};
    /// Speed-scale random walk. 0.006 lets the scale move ~0.1 over five minutes.
    double speed_scale_random_walk{0.006};
    /// Heading-bias random walk. This state models compass calibration error, which is
    /// essentially static; it must NOT be allowed to chase crab angle. Crab is a current
    /// effect, fixed in the world frame, so letting the vehicle-frame heading bias absorb it
    /// mis-attributes the error and it inverts as soon as the bot turns onto a new heading.
    double heading_bias_random_walk{0.0001};

    /// GNSS position noise, m. Measured stationary scatter is 1.1-1.5 m.
    double gnss_position_noise{1.5};
    /// GNSS ground-velocity noise, m/s. Measured speed-over-ground jitter is 0.14-0.19 m/s.
    double gnss_velocity_noise{0.20};

    /// Innovation gates, in sigma.
    double position_gate_sigma{6.0};
    double velocity_gate_sigma{5.0};
    /// Once this many fixes in a row have been gated out, trust the sensor over the estimate.
    int max_consecutive_rejections{10};

    /// Bounds keeping the online calibration physical.
    double min_speed_scale{0.4};
    double max_speed_scale{2.0};
    double max_current{2.0};
    double max_heading_bias{deg_to_rad(15.0)};
    double max_surge{6.0};

    /// Initial uncertainty.
    double initial_position_sigma{50.0};
    double initial_surge_sigma{1.0};
    double initial_current_sigma{0.5};
    double initial_speed_scale_sigma{0.25};
    double initial_heading_bias_sigma{deg_to_rad(10.0)};

    /// Longest single propagation step, s.
    double max_propagation_step{0.5};
};

/// Model-aided horizontal dead reckoning.
///
/// Positions and velocities are local tangent-plane (east, north) in metres. The velocity
/// model is
///
///     v_ground = surge * u(heading + heading_bias) + current
///
/// with `surge` relaxing toward `speed_scale * thrust_model(rpm)`. While GNSS is available
/// the current, speed scale and heading bias are all observable; when it is lost they stop
/// updating and the position propagates on the last calibration.
class DeadReckoner
{
  public:
    static constexpr std::size_t n_states = 7;
    static constexpr std::size_t i_east = 0;
    static constexpr std::size_t i_north = 1;
    static constexpr std::size_t i_surge = 2;
    static constexpr std::size_t i_current_east = 3;
    static constexpr std::size_t i_current_north = 4;
    static constexpr std::size_t i_speed_scale = 5;
    static constexpr std::size_t i_heading_bias = 6;

    using State = Vector<n_states>;
    using Covariance = Matrix<n_states, n_states>;

    DeadReckoner(const DeadReckonerConfig& config = {}, const ThrustModel& thrust = {})
        : cfg_(config), thrust_(thrust)
    {
        x_[i_speed_scale] = 1.0;
        reset_covariance();
    }

    const DeadReckonerConfig& config() const { return cfg_; }
    const ThrustModel& thrust_model() const { return thrust_; }
    const State& state() const { return x_; }
    const Covariance& covariance() const { return P_; }
    bool initialised() const { return initialised_; }

    Vector2 position() const { return Vector2({x_[i_east], x_[i_north]}); }
    double surge() const { return x_[i_surge]; }
    Vector2 current() const { return Vector2({x_[i_current_east], x_[i_current_north]}); }
    double speed_scale() const { return x_[i_speed_scale]; }
    double heading_bias() const { return x_[i_heading_bias]; }

    /// Root sum of the horizontal position variances, m.
    double position_sigma() const
    {
        return std::sqrt(std::max(0.0, P_(i_east, i_east) + P_(i_north, i_north)));
    }

    /// Ground velocity implied by the current state, given the latest heading, as (east, north).
    Vector2 ground_velocity(double heading) const
    {
        const double psi = heading + x_[i_heading_bias];
        return Vector2({x_[i_surge] * std::sin(psi) + x_[i_current_east],
                        x_[i_surge] * std::cos(psi) + x_[i_current_north]});
    }

    double speed_over_ground(double heading) const { return ground_velocity(heading).norm(); }

    /// Course over ground implied by the current state, in [0, 2*pi). Meaningless at rest,
    /// so nullopt below a small speed.
    std::optional<double> course_over_ground(double heading, double min_speed = 0.15) const
    {
        const Vector2 v = ground_velocity(heading);
        if (v.norm() < min_speed) return std::nullopt;
        return wrap_two_pi(std::atan2(v[0], v[1]));
    }

    /// Seed the position and clear its uncertainty. Calibration states are preserved.
    void reset_position(const Vector2& east_north, double sigma)
    {
        x_[i_east] = east_north[0];
        x_[i_north] = east_north[1];
        for (std::size_t i = 0; i < n_states; ++i)
        {
            P_(i_east, i) = P_(i, i_east) = 0.0;
            P_(i_north, i) = P_(i, i_north) = 0.0;
        }
        P_(i_east, i_east) = P_(i_north, i_north) = sigma * sigma;
        initialised_ = true;
    }

    /// Everything the propagation needs from outside the horizontal filter.
    struct Input
    {
        /// Bearing of the forward axis, true north, rad.
        double heading{0.0};
        /// Variance of that bearing, rad^2, from the attitude filter.
        double heading_variance{0.0};
        double rpm{0.0};
        /// cos(pitch): the fraction of forward thrust that acts horizontally. A diving or
        /// nose-up jaiabot drives its propeller partly into the vertical.
        double forward_horizontal_fraction{1.0};
    };

    void propagate(const Input& input, double dt)
    {
        if (!initialised_ || !(dt > 0.0) || !std::isfinite(input.heading)) return;

        while (dt > 0.0)
        {
            const double step = std::min(dt, cfg_.max_propagation_step);
            propagate_step(input, step);
            dt -= step;
        }
        clamp_state();
    }

    /// GNSS position fix, in local tangent-plane metres.
    bool update_position(const Vector2& east_north, double sigma)
    {
        if (!initialised_ || !east_north.all_finite() || !(sigma > 0.0)) return false;

        Matrix<2, n_states> H;
        H(0, i_east) = 1.0;
        H(1, i_north) = 1.0;

        const Vector2 residual = east_north - position();
        const double v = sigma * sigma;
        const bool ok = apply_update<2>(
            H, residual, Matrix2::diagonal({v, v}), cfg_.position_gate_sigma,
            position_rejections_ >= cfg_.max_consecutive_rejections);
        position_rejections_ = ok ? 0 : position_rejections_ + 1;
        clamp_state();
        return ok;
    }

    /// GNSS ground velocity, in local tangent-plane metres per second.
    bool update_ground_velocity(const Vector2& velocity_east_north, double heading, double sigma)
    {
        if (!initialised_ || !velocity_east_north.all_finite() || !(sigma > 0.0)) return false;
        if (!std::isfinite(heading)) return false;

        const double psi = heading + x_[i_heading_bias];
        const double s = std::sin(psi), c = std::cos(psi);

        Matrix<2, n_states> H;
        H(0, i_surge) = s;
        H(0, i_current_east) = 1.0;
        H(0, i_heading_bias) = x_[i_surge] * c;
        H(1, i_surge) = c;
        H(1, i_current_north) = 1.0;
        H(1, i_heading_bias) = -x_[i_surge] * s;

        const Vector2 residual = velocity_east_north - ground_velocity(heading);
        const double v = sigma * sigma;
        const bool ok = apply_update<2>(H, residual, Matrix2::diagonal({v, v}),
                                        cfg_.velocity_gate_sigma);
        clamp_state();
        return ok;
    }

    /// GNSS speed and course, the form gpsd actually reports. Course is often absent or
    /// meaningless at low speed, in which case use update_speed_only.
    bool update_speed_and_course(double speed, double course, double heading, double sigma)
    {
        if (!std::isfinite(speed) || !std::isfinite(course)) return false;
        return update_ground_velocity(
            Vector2({speed * std::sin(course), speed * std::cos(course)}), heading, sigma);
    }

    /// Speed-over-ground magnitude only, for when course is unavailable.
    bool update_speed_only(double speed, double heading, double sigma)
    {
        if (!initialised_ || !std::isfinite(speed) || !(sigma > 0.0)) return false;

        const Vector2 v = ground_velocity(heading);
        const double magnitude = v.norm();
        if (magnitude < 1e-3) return false;

        const double psi = heading + x_[i_heading_bias];
        const double s = std::sin(psi), c = std::cos(psi);
        const double ue = v[0] / magnitude, un = v[1] / magnitude;

        Matrix<1, n_states> H;
        H(0, i_surge) = ue * s + un * c;
        H(0, i_current_east) = ue;
        H(0, i_current_north) = un;
        H(0, i_heading_bias) = x_[i_surge] * (ue * c - un * s);

        Vector<1> residual;
        residual[0] = speed - magnitude;
        const bool ok = apply_update<1>(H, residual, Matrix<1, 1>::diagonal({sigma * sigma}),
                                        cfg_.velocity_gate_sigma);
        clamp_state();
        return ok;
    }

  private:
    void reset_covariance()
    {
        const auto sq = [](double v) { return v * v; };
        P_ = Covariance::diagonal({sq(cfg_.initial_position_sigma), sq(cfg_.initial_position_sigma),
                                   sq(cfg_.initial_surge_sigma), sq(cfg_.initial_current_sigma),
                                   sq(cfg_.initial_current_sigma),
                                   sq(cfg_.initial_speed_scale_sigma),
                                   sq(cfg_.initial_heading_bias_sigma)});
    }

    void propagate_step(const Input& input, double dt)
    {
        const double psi = input.heading + x_[i_heading_bias];
        const double s = std::sin(psi), c = std::cos(psi);
        const double surge = x_[i_surge];
        const double fraction =
            std::isfinite(input.forward_horizontal_fraction)
                ? std::clamp(input.forward_horizontal_fraction, 0.0, 1.0)
                : 1.0;
        const double nominal = thrust_.speed(input.rpm) * fraction;
        const double target = x_[i_speed_scale] * nominal;
        const double tau = std::max(cfg_.surge_time_constant, 1e-6);
        // Capped so the discrete first-order lag settles rather than overshooting when the
        // step is long relative to the time constant.
        const double lambda = std::min(1.0, dt / tau);

        x_[i_east] += (surge * s + x_[i_current_east]) * dt;
        x_[i_north] += (surge * c + x_[i_current_north]) * dt;
        x_[i_surge] += (target - surge) * lambda;

        Covariance F = Covariance::identity();
        F(i_east, i_surge) = s * dt;
        F(i_east, i_current_east) = dt;
        F(i_east, i_heading_bias) = surge * c * dt;
        F(i_north, i_surge) = c * dt;
        F(i_north, i_current_north) = dt;
        F(i_north, i_heading_bias) = -surge * s * dt;
        F(i_surge, i_surge) = 1.0 - lambda;
        F(i_surge, i_speed_scale) = nominal * lambda;

        const auto sq = [](double v) { return v * v; };
        Covariance Q = Covariance::diagonal(
            {sq(cfg_.position_noise) * dt, sq(cfg_.position_noise) * dt,
             sq(cfg_.surge_noise) * dt, sq(cfg_.current_random_walk) * dt,
             sq(cfg_.current_random_walk) * dt, sq(cfg_.speed_scale_random_walk) * dt,
             sq(cfg_.heading_bias_random_walk) * dt});

        // Uncertainty in the heading input steers the velocity, so it lands on position
        // across-track. Adding it here keeps the heading-bias state free to model only the
        // slowly varying part.
        if (std::isfinite(input.heading_variance) && input.heading_variance > 0.0)
        {
            const double across = sq(surge * dt) * input.heading_variance;
            Q(i_east, i_east) += across * c * c;
            Q(i_north, i_north) += across * s * s;
            Q(i_east, i_north) += -across * s * c;
            Q(i_north, i_east) += -across * s * c;
        }

        P_ = (F * P_ * F.transpose() + Q).symmetrised();
    }

    void clamp_state()
    {
        x_[i_surge] = std::clamp(x_[i_surge], -cfg_.max_surge, cfg_.max_surge);
        x_[i_current_east] = std::clamp(x_[i_current_east], -cfg_.max_current, cfg_.max_current);
        x_[i_current_north] = std::clamp(x_[i_current_north], -cfg_.max_current, cfg_.max_current);
        x_[i_speed_scale] =
            std::clamp(x_[i_speed_scale], cfg_.min_speed_scale, cfg_.max_speed_scale);
        x_[i_heading_bias] =
            std::clamp(x_[i_heading_bias], -cfg_.max_heading_bias, cfg_.max_heading_bias);
    }

    template <std::size_t M>
    bool apply_update(const Matrix<M, n_states>& H, const Vector<M>& residual,
                      const Matrix<M, M>& R, double gate_sigma, bool bypass_gate = false)
    {
        const Matrix<M, M> S = (H * P_ * H.transpose() + R).symmetrised();
        const auto S_inv = inverse(S);
        if (!S_inv) return false;

        const double normalised_sq = (residual.transpose() * (*S_inv) * residual)(0, 0);
        if (!std::isfinite(normalised_sq)) return false;
        if (!bypass_gate && normalised_sq > gate_sigma * gate_sigma * static_cast<double>(M))
            return false;

        const Matrix<n_states, M> K = P_ * H.transpose() * (*S_inv);
        const State correction = K * residual;
        if (!correction.all_finite()) return false;

        x_ += correction;
        const Covariance IKH = Covariance::identity() - K * H;
        P_ = (IKH * P_ * IKH.transpose() + K * R * K.transpose()).symmetrised();
        return true;
    }

    DeadReckonerConfig cfg_;
    ThrustModel thrust_;
    State x_{};
    Covariance P_{};
    bool initialised_{false};
    int position_rejections_{0};
};

} // namespace nav
} // namespace jaiabot

#endif

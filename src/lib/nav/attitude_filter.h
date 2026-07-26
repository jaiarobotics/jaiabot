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

#ifndef JAIABOT_LIB_NAV_ATTITUDE_FILTER_H
#define JAIABOT_LIB_NAV_ATTITUDE_FILTER_H

#include <algorithm>
#include <cmath>
#include <optional>

#include "jaiabot/nav/quaternion.h"

namespace jaiabot
{
namespace nav
{
/// Tuning for AttitudeFilter. Defaults come from BNO08X datasheet figure 6-14 and from
/// static-window statistics measured on fleet logs.
struct AttitudeConfig
{
    /// Gyro white noise, rad/s/sqrt(s). Measured static noise is ~0.1 deg/s at 10 Hz.
    double gyro_noise{deg_to_rad(0.15)};
    /// Gyro bias random walk, rad/s^2/sqrt(s). Sized so bias can move ~0.05 deg/s per minute.
    double gyro_bias_random_walk{deg_to_rad(0.01)};
    /// Largest gyro bias we are willing to believe, rad/s.
    double max_gyro_bias{deg_to_rad(5.0)};

    /// Noise on the gravity-derived up direction, rad. Datasheet static angle error is 1.5 deg.
    double gravity_noise{deg_to_rad(2.0)};
    /// Reject the gravity report when |g| strays this far from the local value, m/s^2.
    ///
    /// Tried loosening this to [3, 20] on the argument that update_gravity() only ever uses the
    /// NORMALISED vector, so a magnitude error should be harmless as long as direction is sound
    /// (2 of 48 fleet logs have a systematic magnitude scale error, median 6.4-8.5 m/s^2, that
    /// this tight band rejects on 49-72% of samples). REVERTED: an independent rebuild/replay
    /// A/B across all 48 logs found the loosened gate produced byte-identical position/velocity
    /// trajectories on both affected logs despite the huge change in raw rejection rate - the
    /// gravity_gate_sigma innovation gate below already screens the same samples on direction,
    /// so the magnitude pre-filter's rejections were not actually contributing tilt aiding that
    /// mattered. Loosening it also opens an unexamined interaction with the consecutive-rejection
    /// bypass (max_consecutive_rejections): samples with a corrupted direction that used to be
    /// screened out before ever reaching the innovation gate could now advance that counter and
    /// eventually force an unconditional accept, right around the high-dynamics dive transitions
    /// where calibration integrity matters most. Zero measured benefit plus a real, unaddressed
    /// risk is not worth carrying.
    double gravity_magnitude_tolerance{2.5};
    double gravity_magnitude{9.81};

    /// Heading noise from the rotation vector, rad. Datasheet says 5 deg in practice.
    double rotation_vector_heading_noise{deg_to_rad(5.0)};
    /// Heading noise from a tilt-compensated magnetometer, rad.
    double magnetometer_heading_noise{deg_to_rad(6.0)};
    /// Multiply heading noise by this for each step the reported accuracy is below high.
    double accuracy_degradation_factor{2.5};

    /// Reject heading corrections whose innovation exceeds this many sigma.
    double heading_gate_sigma{4.0};
    /// Reject gravity corrections whose innovation exceeds this many sigma.
    double gravity_gate_sigma{4.0};
    /// Once this many corrections in a row have been gated out, the estimate is more likely
    /// wrong than the sensor, so accept the next one regardless.
    int max_consecutive_rejections{10};

    /// Skip heading corrections once the nose is steeper than this. Heading is the bearing of
    /// the forward axis, so it is ill-conditioned as that axis approaches vertical - and the
    /// jaiabot spends real time nose-up at the surface and nose-down in a dive.
    double max_heading_update_pitch{deg_to_rad(60.0)};

    /// Initial uncertainty, rad and rad/s.
    double initial_tilt_sigma{deg_to_rad(10.0)};
    double initial_heading_sigma{deg_to_rad(60.0)};
    double initial_gyro_bias_sigma{deg_to_rad(1.0)};

    /// Longest gyro-only propagation step we accept, s. Longer gaps only inflate covariance.
    double max_propagation_step{0.5};
};

/// Multiplicative EKF over orientation and gyro bias.
///
/// Error state is [tilt_error(3), gyro_bias_error(3)], with the orientation error defined
/// in the body frame: q_true = q_estimate * exp_map(tilt_error).
class AttitudeFilter
{
  public:
    static constexpr std::size_t n_states = 6;
    using Covariance = Matrix<n_states, n_states>;

    explicit AttitudeFilter(const AttitudeConfig& config = {}) : cfg_(config) { reset_covariance(); }

    const AttitudeConfig& config() const { return cfg_; }
    bool initialised() const { return initialised_; }
    const Quaternion& orientation() const { return q_; }
    const Vector3& gyro_bias() const { return bias_; }
    const Covariance& covariance() const { return P_; }

    double heading() const { return q_.heading(); }
    double pitch() const { return q_.pitch(); }
    double roll() const { return q_.roll(); }

    /// Variance of the heading estimate, rad^2, mapped from the body-frame tilt covariance.
    double heading_variance() const
    {
        const Matrix<1, 3> h = heading_jacobian();
        return (h * P_.block<3, 3>(0, 0) * h.transpose())(0, 0);
    }

    /// Root sum of the two horizontal tilt variances, rad.
    double tilt_sigma() const { return std::sqrt(std::max(0.0, P_(0, 0) + P_(1, 1))); }

    /// Adopt an orientation outright and reset the covariance. Used at startup.
    void reset(const Quaternion& orientation, bool keep_bias = false)
    {
        const auto n = orientation.normalised();
        if (!n) return;
        q_ = *n;
        if (!keep_bias) bias_ = Vector3{};
        reset_covariance();
        initialised_ = true;
    }

    /// Initialise from a gravity report and a heading, both as delivered by the IMU.
    bool initialise(const Vector3& up_body, double heading_true)
    {
        const auto q = from_up_and_heading(up_body, heading_true);
        if (!q) return false;
        reset(*q);
        return true;
    }

    /// Integrate the bias-corrected body rate. Steps longer than max_propagation_step are
    /// split so the linearisation stays valid.
    void propagate(const Vector3& gyro_body, double dt)
    {
        if (!initialised_ || !(dt > 0.0) || !gyro_body.all_finite()) return;

        while (dt > 0.0)
        {
            const double step = std::min(dt, cfg_.max_propagation_step);
            propagate_step(gyro_body, step);
            dt -= step;
        }
    }

    /// Correct roll and pitch from the IMU gravity report (the up vector in body coordinates).
    /// Returns false when the measurement was rejected.
    bool update_gravity(const Vector3& gravity_body)
    {
        if (!initialised_ || !gravity_body.all_finite()) return false;

        const double magnitude = gravity_body.norm();
        if (std::abs(magnitude - cfg_.gravity_magnitude) > cfg_.gravity_magnitude_tolerance)
            return false;

        const auto measured = normalised(gravity_body);
        if (!measured) return false;

        const Vector3 predicted = q_.rotate_inverse(Vector3({0.0, 0.0, 1.0}));

        // v_body(true) ~= v_body(pred) + skew(v_body(pred)) * tilt_error
        Matrix<3, n_states> H;
        H.set_block<3, 3>(0, 0, skew(predicted));

        const Vector3 residual = *measured - predicted;
        const double variance = cfg_.gravity_noise * cfg_.gravity_noise;
        const bool ok = apply_update<3>(
            H, residual, Matrix3::diagonal({variance, variance, variance}),
            cfg_.gravity_gate_sigma, gravity_rejections_ >= cfg_.max_consecutive_rejections);
        gravity_rejections_ = ok ? 0 : gravity_rejections_ + 1;
        return ok;
    }

    /// Whether the forward axis is far enough from vertical for heading to be meaningful.
    bool heading_observable() const
    {
        return std::abs(q_.pitch()) <= cfg_.max_heading_update_pitch;
    }

    /// Correct heading against a true-north bearing measurement.
    bool update_heading(double heading_true, double sigma)
    {
        if (!initialised_ || !std::isfinite(heading_true) || !(sigma > 0.0)) return false;
        if (!heading_observable()) return false;

        Matrix<1, n_states> H;
        H.set_block<1, 3>(0, 0, heading_jacobian());

        Vector<1> residual;
        residual[0] = wrap_pi(heading_true - q_.heading());
        const bool ok = apply_update<1>(
            H, residual, Matrix<1, 1>::diagonal({sigma * sigma}), cfg_.heading_gate_sigma,
            heading_rejections_ >= cfg_.max_consecutive_rejections);
        heading_rejections_ = ok ? 0 : heading_rejections_ + 1;
        return ok;
    }

    /// Correct heading from the BNO08x rotation vector, which is referenced to magnetic north.
    /// `accuracy` is IMUData.accuracies.magnetometer (0 unreliable .. 3 high).
    bool update_rotation_vector(const Quaternion& q_magnetic, double declination, int accuracy)
    {
        const auto q = q_magnetic.normalised();
        if (!q) return false;
        const double heading = apply_declination(*q, declination).heading();
        return update_heading(heading, heading_sigma(cfg_.rotation_vector_heading_noise, accuracy));
    }

    /// Correct heading from a tilt-compensated magnetometer reading in body coordinates.
    /// The horizontal part of the field, rotated into the true-north frame, must bear along
    /// `declination`; the shortfall is the heading error.
    bool update_magnetometer(const Vector3& magnetic_field_body, double declination, int accuracy)
    {
        if (!initialised_ || !magnetic_field_body.all_finite()) return false;

        const Vector3 world = q_.rotate(magnetic_field_body);
        if (std::hypot(world[0], world[1]) < 1e-6) return false;

        const double bearing = std::atan2(world[0], world[1]);
        const double heading = wrap_two_pi(q_.heading() - wrap_pi(bearing - declination));
        return update_heading(heading, heading_sigma(cfg_.magnetometer_heading_noise, accuracy));
    }

    /// Inflate heading noise as the reported magnetometer accuracy degrades.
    double heading_sigma(double base_sigma, int accuracy) const
    {
        const int steps = std::clamp(3 - accuracy, 0, 3);
        return base_sigma * std::pow(cfg_.accuracy_degradation_factor, steps);
    }

    static Matrix3 skew(const Vector3& v)
    {
        return Matrix3({0.0, -v[2], v[1], v[2], 0.0, -v[0], -v[1], v[0], 0.0});
    }

  private:
    void reset_covariance()
    {
        const double t = cfg_.initial_tilt_sigma * cfg_.initial_tilt_sigma;
        const double h = cfg_.initial_heading_sigma * cfg_.initial_heading_sigma;
        const double b = cfg_.initial_gyro_bias_sigma * cfg_.initial_gyro_bias_sigma;
        // Tilt error about body X/Y is roll/pitch; about body Z it is (mostly) heading.
        P_ = Covariance::diagonal({t, t, h, b, b, b});
    }

    void propagate_step(const Vector3& gyro_body, double dt)
    {
        const Vector3 rate = gyro_body - bias_;
        const auto advanced = (q_ * exp_map(rate * dt)).normalised();
        if (advanced) q_ = *advanced;

        // d/dt [tilt; bias] = [-skew(rate) * tilt - bias; 0]
        Covariance F = Covariance::identity();
        F.set_block<3, 3>(0, 0, Matrix3::identity() - skew(rate) * dt);
        F.set_block<3, 3>(0, 3, Matrix3::identity() * -dt);

        const double qg = cfg_.gyro_noise * cfg_.gyro_noise * dt;
        const double qb = cfg_.gyro_bias_random_walk * cfg_.gyro_bias_random_walk * dt;
        const Covariance Q = Covariance::diagonal({qg, qg, qg, qb, qb, qb});

        P_ = (F * P_ * F.transpose() + Q).symmetrised();
    }

    /// Partial derivative of heading with respect to the body-frame tilt error.
    Matrix<1, 3> heading_jacobian() const
    {
        const Vector3 f = q_.forward();
        const double h = f[0] * f[0] + f[1] * f[1];
        // World-frame rotation error e changes heading by f_u*(f_e*e_e + f_n*e_n)/h - e_u.
        Matrix<1, 3> world;
        if (h < 1e-9)
        {
            world(0, 0) = 0.0;
            world(0, 1) = 0.0;
            world(0, 2) = -1.0;
        }
        else
        {
            world(0, 0) = f[2] * f[0] / h;
            world(0, 1) = f[2] * f[1] / h;
            world(0, 2) = -1.0;
        }
        return world * q_.rotation_matrix();
    }

    /// Joseph-form Kalman update with chi-square style gating on the innovation.
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
        const Vector<n_states> correction = K * residual;
        if (!correction.all_finite()) return false;

        const Covariance IKH = Covariance::identity() - K * H;
        P_ = (IKH * P_ * IKH.transpose() + K * R * K.transpose()).symmetrised();

        const Vector3 tilt({correction[0], correction[1], correction[2]});
        const auto corrected = (q_ * exp_map(tilt)).normalised();
        if (corrected) q_ = *corrected;

        for (std::size_t i = 0; i < 3; ++i)
            bias_[i] = std::clamp(bias_[i] + correction[3 + i], -cfg_.max_gyro_bias,
                                  cfg_.max_gyro_bias);
        return true;
    }

    AttitudeConfig cfg_;
    Quaternion q_{Quaternion::identity()};
    Vector3 bias_{};
    Covariance P_{};
    bool initialised_{false};
    int heading_rejections_{0};
    int gravity_rejections_{0};
};

} // namespace nav
} // namespace jaiabot

#endif

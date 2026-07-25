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

#ifndef JAIABOT_LIB_NAV_STATE_ESTIMATOR_H
#define JAIABOT_LIB_NAV_STATE_ESTIMATOR_H

#include <algorithm>
#include <cmath>
#include <limits>
#include <optional>

#include "jaiabot/nav/attitude_filter.h"
#include "jaiabot/nav/dead_reckoner.h"
#include "jaiabot/nav/geodesy.h"
#include "jaiabot/nav/quaternion.h"
#include "jaiabot/nav/vertical_filter.h"

namespace jaiabot
{
namespace nav
{
/// One IMUData message. Fields the deployed firmware omits are simply left unset.
struct ImuSample
{
    double time{0.0};
    /// Rotation vector, body to magnetic-north ENU, as published in IMUData.quaternion.
    std::optional<Quaternion> quaternion;
    /// IMUData.gravity: the up vector in body coordinates, m/s^2.
    std::optional<Vector3> gravity;
    /// IMUData.angular_velocity: body rates, rad/s.
    std::optional<Vector3> angular_velocity;
    /// IMUData.magnetic_field, microtesla. Absent on current fleet firmware.
    std::optional<Vector3> magnetic_field;
    /// IMUData.accuracies.magnetometer, 0 unreliable .. 3 high.
    int magnetometer_accuracy{3};
};

/// One gpsd TimePositionVelocity message.
struct GnssSample
{
    double time{0.0};
    double lat{0.0};
    double lon{0.0};
    /// gpsd mode: 1 no fix, 2 two-dimensional, 3 three-dimensional.
    int mode{0};
    std::optional<double> speed_over_ground;
    /// Course over ground, rad, clockwise from true north. Often absent in practice.
    std::optional<double> course_over_ground;
};

struct MotorSample
{
    double time{0.0};
    double rpm{0.0};
};

struct PressureSample
{
    double time{0.0};
    double depth{0.0};
};

/// How the horizontal solution is currently being maintained.
enum class NavMode
{
    /// Nothing usable yet.
    uninitialised,
    /// GNSS is fixing position and calibrating the model.
    gnss_aided,
    /// No GNSS: propagating the calibrated speed and current model.
    dead_reckoning
};

struct NavSolution
{
    double time{0.0};
    NavMode mode{NavMode::uninitialised};

    bool attitude_valid{false};
    bool position_valid{false};

    double lat{0.0};
    double lon{0.0};
    Vector2 position_east_north{};
    double position_sigma{0.0};

    /// Radians. Heading, course and their bias are clockwise from true north.
    double heading{0.0};
    double heading_sigma{0.0};
    double pitch{0.0};
    double roll{0.0};

    double speed_over_ground{0.0};
    std::optional<double> course_over_ground;
    /// Signed speed through water along the forward axis, m/s.
    double speed_through_water{0.0};

    Vector2 current_east_north{};
    double speed_scale{1.0};
    double heading_bias{0.0};

    double depth{0.0};
    double depth_rate{0.0};

    /// Seconds since the last usable GNSS fix; infinite before the first one.
    double gnss_fix_age{std::numeric_limits<double>::infinity()};
    /// Distance travelled since the last usable GNSS fix, m.
    double dead_reckoned_distance{0.0};
};

struct StateEstimatorConfig
{
    AttitudeConfig attitude;
    DeadReckonerConfig dead_reckoner;
    VerticalConfig vertical;

    /// Magnetic declination, rad, positive east. Set from WMM at the current position.
    double declination{0.0};

    /// Treat GNSS as unavailable once a fix is older than this, s.
    double gnss_timeout{3.0};
    /// Ignore IMU samples separated by more than this; re-initialise instead, s.
    double imu_gap_reset{30.0};
    /// Stop trusting rpm once the motor message is older than this, s.
    double motor_timeout{5.0};
    /// Below this speed over ground, GNSS course is too noisy to use, m/s.
    double min_course_speed{0.5};
    /// Below this speed over ground, skip the velocity update entirely. Speed over ground is a
    /// magnitude, so averaging it near zero rectifies noise into a positive bias, which the
    /// filter would absorb as a nonexistent current and then integrate through every outage.
    double min_velocity_update_speed{0.6};
    /// Prefer the magnetometer over the rotation vector when it is present.
    bool prefer_magnetometer{false};
};

/// Counters for how each measurement stream is being used, for health reporting and for
/// diagnosing tuning problems offline.
struct EstimatorDiagnostics
{
    long imu_samples{0};
    long imu_dropped{0};
    long attitude_resets{0};
    long gnss_fixes{0};
    long gnss_no_fix{0};
    long position_accepted{0};
    long position_rejected{0};
    long velocity_accepted{0};
    long velocity_rejected{0};
    long speed_accepted{0};
    long speed_rejected{0};
    long heading_updates_skipped_steep{0};
};

/// Top-level estimator: attitude, model-aided horizontal dead reckoning, and depth.
///
/// Each handler advances the filters to its own timestamp before applying its measurement,
/// so callers may deliver messages at their natural rates in any interleaving. Samples that
/// arrive out of order are dropped.
class StateEstimator
{
  public:
    explicit StateEstimator(const StateEstimatorConfig& config = {})
        : cfg_(config), attitude_(config.attitude),
          dead_reckoner_(config.dead_reckoner, ThrustModel{}), vertical_(config.vertical)
    {
    }

    StateEstimator(const StateEstimatorConfig& config, const ThrustModel& thrust)
        : cfg_(config), attitude_(config.attitude),
          dead_reckoner_(config.dead_reckoner, thrust), vertical_(config.vertical)
    {
    }

    const StateEstimatorConfig& config() const { return cfg_; }
    const AttitudeFilter& attitude() const { return attitude_; }
    const DeadReckoner& dead_reckoner() const { return dead_reckoner_; }
    const VerticalFilter& vertical() const { return vertical_; }
    const LocalTangentPlane& tangent_plane() const { return plane_; }
    const EstimatorDiagnostics& diagnostics() const { return diagnostics_; }

    /// Declination is position-dependent, so the app refreshes it as the bot moves.
    void set_declination(double declination)
    {
        if (std::isfinite(declination)) cfg_.declination = declination;
    }

    /// Pin the tangent-plane origin. Otherwise the first usable fix sets it.
    void set_origin(double lat, double lon) { plane_ = LocalTangentPlane(lat, lon); }

    void handle_imu(const ImuSample& sample)
    {
        if (!std::isfinite(sample.time)) return;
        if (last_imu_time_ && sample.time <= *last_imu_time_)
        {
            ++diagnostics_.imu_dropped;
            return;
        }
        ++diagnostics_.imu_samples;

        const double gap = last_imu_time_ ? sample.time - *last_imu_time_ : 0.0;
        last_imu_time_ = sample.time;

        if (gap > cfg_.imu_gap_reset)
        {
            attitude_ = AttitudeFilter(cfg_.attitude);
            ++diagnostics_.attitude_resets;
        }

        if (!attitude_.initialised())
        {
            initialise_attitude(sample);
            if (!attitude_.initialised()) return;
            advance_to(sample.time);
            return;
        }

        advance_to(sample.time);

        if (sample.angular_velocity && gap > 0.0)
            attitude_.propagate(*sample.angular_velocity, std::min(gap, cfg_.imu_gap_reset));

        if (sample.gravity) attitude_.update_gravity(*sample.gravity);
        if (!attitude_.heading_observable()) ++diagnostics_.heading_updates_skipped_steep;

        const bool use_mag = sample.magnetic_field && cfg_.prefer_magnetometer;
        if (use_mag)
            attitude_.update_magnetometer(*sample.magnetic_field, cfg_.declination,
                                          sample.magnetometer_accuracy);
        else if (sample.quaternion)
            attitude_.update_rotation_vector(*sample.quaternion, cfg_.declination,
                                             sample.magnetometer_accuracy);
        else if (sample.magnetic_field)
            attitude_.update_magnetometer(*sample.magnetic_field, cfg_.declination,
                                          sample.magnetometer_accuracy);
    }

    void handle_gnss(const GnssSample& sample)
    {
        if (!std::isfinite(sample.time) || !std::isfinite(sample.lat) || !std::isfinite(sample.lon))
            return;
        if (last_gnss_time_ && sample.time <= *last_gnss_time_) return;
        last_gnss_time_ = sample.time;

        if (sample.mode < 2)
        {
            ++diagnostics_.gnss_no_fix;
            return;
        }
        ++diagnostics_.gnss_fixes;
        if (std::abs(sample.lat) > 90.0 || std::abs(sample.lon) > 180.0) return;

        if (!plane_.valid()) plane_ = LocalTangentPlane(sample.lat, sample.lon);

        advance_to(sample.time);
        const Vector2 local = plane_.to_local(sample.lat, sample.lon);

        if (!dead_reckoner_.initialised())
            dead_reckoner_.reset_position(local, cfg_.dead_reckoner.gnss_position_noise);
        else if (dead_reckoner_.update_position(local, cfg_.dead_reckoner.gnss_position_noise))
            ++diagnostics_.position_accepted;
        else
            ++diagnostics_.position_rejected;

        if (sample.speed_over_ground && attitude_.initialised() &&
            *sample.speed_over_ground >= cfg_.min_velocity_update_speed)
        {
            const double speed = *sample.speed_over_ground;
            const double sigma = cfg_.dead_reckoner.gnss_velocity_noise;
            if (sample.course_over_ground && speed >= cfg_.min_course_speed)
            {
                if (dead_reckoner_.update_speed_and_course(speed, *sample.course_over_ground,
                                                           attitude_.heading(), sigma))
                    ++diagnostics_.velocity_accepted;
                else
                    ++diagnostics_.velocity_rejected;
            }
            else if (dead_reckoner_.update_speed_only(speed, attitude_.heading(), sigma))
                ++diagnostics_.speed_accepted;
            else
                ++diagnostics_.speed_rejected;
        }

        last_fix_time_ = sample.time;
        dead_reckoned_distance_ = 0.0;
    }

    void handle_motor(const MotorSample& sample)
    {
        if (!std::isfinite(sample.time) || !std::isfinite(sample.rpm)) return;
        if (last_motor_time_ && sample.time < *last_motor_time_) return;
        advance_to(sample.time);
        last_motor_time_ = sample.time;
        rpm_ = sample.rpm;
    }

    void handle_pressure(const PressureSample& sample)
    {
        if (!std::isfinite(sample.time) || !std::isfinite(sample.depth)) return;
        if (last_pressure_time_ && sample.time <= *last_pressure_time_) return;
        last_pressure_time_ = sample.time;
        advance_to(sample.time);
        vertical_.update_depth(sample.depth, cfg_.vertical.depth_noise);
    }

    /// Advance every filter to `time` without applying a measurement. Safe to call as often
    /// as the caller wants output.
    void advance_to(double time)
    {
        if (!std::isfinite(time)) return;
        if (!filter_time_)
        {
            filter_time_ = time;
            return;
        }
        const double dt = time - *filter_time_;
        if (!(dt > 0.0)) return;
        filter_time_ = time;

        vertical_.propagate(dt);

        if (!dead_reckoner_.initialised() || !attitude_.initialised()) return;

        DeadReckoner::Input input;
        input.heading = attitude_.heading();
        input.heading_variance = attitude_.heading_variance();
        input.rpm = motor_fresh(time) ? rpm_ : 0.0;
        input.forward_horizontal_fraction = std::cos(attitude_.pitch());

        const Vector2 before = dead_reckoner_.position();
        dead_reckoner_.propagate(input, dt);
        if (!gnss_fresh(time))
            dead_reckoned_distance_ += (dead_reckoner_.position() - before).norm();
    }

    NavSolution solution() const
    {
        NavSolution s;
        s.time = filter_time_.value_or(0.0);
        s.attitude_valid = attitude_.initialised();
        s.position_valid = dead_reckoner_.initialised() && plane_.valid();

        if (s.attitude_valid)
        {
            s.heading = attitude_.heading();
            s.heading_sigma = std::sqrt(std::max(0.0, attitude_.heading_variance()));
            s.pitch = attitude_.pitch();
            s.roll = attitude_.roll();
        }

        if (s.position_valid)
        {
            s.position_east_north = dead_reckoner_.position();
            s.position_sigma = dead_reckoner_.position_sigma();
            const Vector2 geo = plane_.to_geographic(s.position_east_north);
            s.lat = geo[0];
            s.lon = geo[1];
            s.speed_over_ground = dead_reckoner_.speed_over_ground(s.heading);
            s.course_over_ground = dead_reckoner_.course_over_ground(s.heading);
            s.speed_through_water = dead_reckoner_.surge();
            s.current_east_north = dead_reckoner_.current();
            s.speed_scale = dead_reckoner_.speed_scale();
            s.heading_bias = dead_reckoner_.heading_bias();
        }

        s.depth = vertical_.depth();
        s.depth_rate = vertical_.depth_rate();

        s.gnss_fix_age = last_fix_time_ && filter_time_
                             ? *filter_time_ - *last_fix_time_
                             : std::numeric_limits<double>::infinity();
        s.dead_reckoned_distance = dead_reckoned_distance_;

        if (!s.position_valid)
            s.mode = NavMode::uninitialised;
        else if (s.gnss_fix_age <= cfg_.gnss_timeout)
            s.mode = NavMode::gnss_aided;
        else
            s.mode = NavMode::dead_reckoning;

        return s;
    }

  private:
    void initialise_attitude(const ImuSample& sample)
    {
        if (sample.gravity && sample.quaternion)
        {
            const auto q = sample.quaternion->normalised();
            if (q)
            {
                const double heading = apply_declination(*q, cfg_.declination).heading();
                if (attitude_.initialise(*sample.gravity, heading)) return;
            }
        }
        if (sample.quaternion)
        {
            const auto q = sample.quaternion->normalised();
            if (q) attitude_.reset(apply_declination(*q, cfg_.declination));
        }
    }

    bool gnss_fresh(double time) const
    {
        return last_fix_time_ && (time - *last_fix_time_) <= cfg_.gnss_timeout;
    }

    bool motor_fresh(double time) const
    {
        return last_motor_time_ && (time - *last_motor_time_) <= cfg_.motor_timeout;
    }

    StateEstimatorConfig cfg_;
    AttitudeFilter attitude_;
    DeadReckoner dead_reckoner_;
    VerticalFilter vertical_;
    LocalTangentPlane plane_;

    std::optional<double> filter_time_;
    std::optional<double> last_imu_time_;
    std::optional<double> last_gnss_time_;
    std::optional<double> last_motor_time_;
    std::optional<double> last_pressure_time_;
    std::optional<double> last_fix_time_;

    double rpm_{0.0};
    double dead_reckoned_distance_{0.0};
    EstimatorDiagnostics diagnostics_{};
};

} // namespace nav
} // namespace jaiabot

#endif

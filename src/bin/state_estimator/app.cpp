// Copyright 2025:
//   JaiaRobotics LLC
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

// Runs the src/lib/nav estimator on the bot: subscribes to the IMU, gpsd, motor and pressure
// streams and publishes a NavSolution that keeps propagating through GNSS outages.
//
// This app deliberately does not replace jaiabot_fusion. It publishes alongside it so the two
// can be compared in flight; set publish_to_node_status once the solution is trusted.

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/motor.pb.h"
#include "jaiabot/messages/nav.pb.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"
#include "jaiabot/nav/state_estimator.h"

#include "wmm/WMM.h"

#include <cmath>

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::StateEstimator>;

namespace jaiabot
{
namespace apps
{
class StateEstimatorApp : public ApplicationBase
{
  public:
    StateEstimatorApp();

  private:
    void loop() override;

    /// Seconds since the UNIX epoch, as the nav library expects.
    static double now_seconds()
    {
        return goby::time::SystemClock::now<goby::time::SITime>().value();
    }

    nav::StateEstimatorConfig make_config() const;
    nav::ThrustModel make_thrust_model() const;
    void refresh_declination();
    void publish_solution();

    nav::StateEstimator estimator_;
    WMM wmm_;
    double last_declination_lat_{std::numeric_limits<double>::quiet_NaN()};
    double last_declination_lon_{std::numeric_limits<double>::quiet_NaN()};
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::StateEstimatorApp>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::StateEstimator>(argc, argv));
}

jaiabot::nav::ThrustModel jaiabot::apps::StateEstimatorApp::make_thrust_model() const
{
    nav::ThrustModel model;
    if (cfg().thrust_curve_size() > 0)
    {
        std::vector<nav::ThrustModel::Point> points;
        points.reserve(cfg().thrust_curve_size());
        for (const auto& p : cfg().thrust_curve()) points.push_back({p.rpm(), p.speed()});
        model = nav::ThrustModel(std::move(points));
    }
    model.set_reverse_efficiency(cfg().reverse_efficiency());
    model.set_deadband_rpm(cfg().deadband_rpm());
    return model;
}

jaiabot::nav::StateEstimatorConfig jaiabot::apps::StateEstimatorApp::make_config() const
{
    nav::StateEstimatorConfig config;
    config.gnss_timeout = cfg().gnss_timeout();
    config.imu_gap_reset = cfg().imu_gap_reset();
    config.motor_timeout = cfg().motor_timeout();
    config.min_course_speed = cfg().min_course_speed();
    config.min_velocity_update_speed = cfg().min_velocity_update_speed();
    config.prefer_magnetometer = cfg().prefer_magnetometer();

    config.dead_reckoner.gnss_position_noise = cfg().gnss_position_noise();
    config.dead_reckoner.gnss_velocity_noise = cfg().gnss_velocity_noise();
    config.dead_reckoner.surge_time_constant = cfg().surge_time_constant();
    config.dead_reckoner.current_random_walk = cfg().current_random_walk();
    config.dead_reckoner.speed_scale_random_walk = cfg().speed_scale_random_walk();
    config.dead_reckoner.heading_bias_random_walk = cfg().heading_bias_random_walk();

    config.attitude.rotation_vector_heading_noise =
        nav::deg_to_rad(cfg().rotation_vector_heading_noise());
    config.attitude.max_heading_update_pitch = nav::deg_to_rad(cfg().max_heading_update_pitch());
    return config;
}

jaiabot::apps::StateEstimatorApp::StateEstimatorApp()
    : ApplicationBase(cfg().publish_rate() * si::hertz),
      estimator_(make_config(), make_thrust_model())
{
    interprocess().subscribe<groups::imu>([this](const protobuf::IMUData& data) {
        nav::ImuSample sample;
        sample.time = now_seconds();

        if (data.has_quaternion())
        {
            const auto& q = data.quaternion();
            const nav::Quaternion candidate(q.w(), q.x(), q.y(), q.z());
            if (candidate.is_valid()) sample.quaternion = candidate;
        }
        if (data.has_gravity())
            sample.gravity =
                nav::Vector3({data.gravity().x(), data.gravity().y(), data.gravity().z()});
        if (data.has_angular_velocity())
            sample.angular_velocity = nav::Vector3({data.angular_velocity().x(),
                                                    data.angular_velocity().y(),
                                                    data.angular_velocity().z()});
        if (data.has_magnetic_field())
            sample.magnetic_field = nav::Vector3({data.magnetic_field().x(),
                                                 data.magnetic_field().y(),
                                                 data.magnetic_field().z()});
        if (data.has_accuracies())
            sample.magnetometer_accuracy = data.accuracies().magnetometer();

        estimator_.handle_imu(sample);
    });

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            if (!tpv.has_location()) return;

            nav::GnssSample sample;
            sample.time = now_seconds();
            sample.lat = tpv.location().lat();
            sample.lon = tpv.location().lon();
            sample.mode = tpv.has_mode() ? static_cast<int>(tpv.mode()) : 0;
            if (tpv.has_speed() && std::isfinite(tpv.speed()))
                sample.speed_over_ground = tpv.speed();
            if (tpv.has_track() && std::isfinite(tpv.track()))
                sample.course_over_ground = nav::deg_to_rad(tpv.track());

            estimator_.handle_gnss(sample);
            refresh_declination();
        });

    interprocess().subscribe<groups::motor_status>([this](const protobuf::Motor& motor) {
        if (motor.has_rpm()) estimator_.handle_motor({now_seconds(), motor.rpm()});
    });

    interprocess().subscribe<groups::pressure_adjusted>(
        [this](const protobuf::PressureAdjustedData& pressure) {
            if (pressure.has_calculated_depth())
                estimator_.handle_pressure({now_seconds(), pressure.calculated_depth()});
        });
}

/// The World Magnetic Model lookup is not cheap, and declination barely moves over a bot's
/// operating area, so refresh it only after the position has moved appreciably.
void jaiabot::apps::StateEstimatorApp::refresh_declination()
{
    const nav::NavSolution solution = estimator_.solution();
    if (!solution.position_valid) return;

    const bool stale = !std::isfinite(last_declination_lat_) ||
                       std::abs(solution.lat - last_declination_lat_) > 0.01 ||
                       std::abs(solution.lon - last_declination_lon_) > 0.01;
    if (!stale) return;

    const double declination = wmm_.magneticDeclination(solution.lon, solution.lat);
    if (!std::isfinite(declination)) return;

    estimator_.set_declination(nav::deg_to_rad(declination));
    last_declination_lat_ = solution.lat;
    last_declination_lon_ = solution.lon;
    glog.is_debug1() && glog << "declination updated to " << declination << " deg" << std::endl;
}

void jaiabot::apps::StateEstimatorApp::loop()
{
    estimator_.advance_to(now_seconds());
    publish_solution();
}

void jaiabot::apps::StateEstimatorApp::publish_solution()
{
    const nav::NavSolution s = estimator_.solution();

    protobuf::NavSolution out;
    switch (s.mode)
    {
        case nav::NavMode::gnss_aided: out.set_mode(protobuf::NAV_MODE__GNSS_AIDED); break;
        case nav::NavMode::dead_reckoning:
            out.set_mode(protobuf::NAV_MODE__DEAD_RECKONING);
            break;
        case nav::NavMode::uninitialised:
        default: out.set_mode(protobuf::NAV_MODE__UNINITIALISED); break;
    }

    out.set_attitude_valid(s.attitude_valid);
    out.set_position_valid(s.position_valid);

    if (s.position_valid)
    {
        out.mutable_location()->set_lat(s.lat);
        out.mutable_location()->set_lon(s.lon);
        out.set_position_sigma(s.position_sigma);
        out.mutable_speed()->set_over_ground(s.speed_over_ground);
        out.mutable_speed()->set_over_water(s.speed_through_water);
        out.mutable_current()->set_east(s.current_east_north[0]);
        out.mutable_current()->set_north(s.current_east_north[1]);
        out.set_speed_scale(s.speed_scale);
        out.set_heading_bias(nav::rad_to_deg(s.heading_bias));
        out.set_dead_reckoned_distance(s.dead_reckoned_distance);
        if (std::isfinite(s.gnss_fix_age)) out.set_gnss_fix_age(s.gnss_fix_age);
    }

    if (s.attitude_valid)
    {
        auto& attitude = *out.mutable_attitude();
        attitude.set_heading(nav::rad_to_deg(s.heading));
        attitude.set_heading_sigma(nav::rad_to_deg(s.heading_sigma));
        attitude.set_pitch(nav::rad_to_deg(s.pitch));
        attitude.set_roll(nav::rad_to_deg(s.roll));
        if (s.course_over_ground) attitude.set_course_over_ground(nav::rad_to_deg(*s.course_over_ground));
    }

    out.set_depth(s.depth);
    out.set_depth_rate(s.depth_rate);
    out.set_magnetic_declination(nav::rad_to_deg(estimator_.config().declination));

    interprocess().publish<groups::nav_solution>(out);

    glog.is_debug2() && glog << "nav: " << out.ShortDebugString() << std::endl;
}

// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
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

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/seawater.h>

#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/control_surfaces.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "jaiabot/messages/salinity.pb.h"
#include "wmm/WMM.h"

#define NOW (goby::time::SystemClock::now<goby::time::MicroTime>())

using goby::glog;
using namespace std;

namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::Fusion>;

namespace jaiabot
{
namespace apps
{
class Fusion : public ApplicationBase
{
  public:
    Fusion();

  private:
    void init_node_status();
    void init_bot_status();

    void loop()
    {
        // DCCL uses the real system clock to encode time, so "unwarp" the time first
        auto unwarped_time = goby::time::convert<goby::time::MicroTime>(
            goby::time::SystemClock::unwarp(goby::time::SystemClock::now()));

        latest_bot_status_.set_time_with_units(unwarped_time);

        if (last_health_report_time_ + std::chrono::seconds(cfg().health_report_timeout_seconds()) <
            goby::time::SteadyClock::now())
        {
            glog.is_warn() && glog << "Timeout on health report" << std::endl;
            latest_bot_status_.set_health_state(goby::middleware::protobuf::HEALTH__FAILED);
            latest_bot_status_.clear_error();
            latest_bot_status_.add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_HEALTH);
        }

        if (latest_bot_status_.IsInitialized())
        {
            glog.is_debug1() && glog << "Publishing bot status over intervehicle(): "
                                     << latest_bot_status_.ShortDebugString() << endl;
            intervehicle().publish<jaiabot::groups::bot_status>(latest_bot_status_);
        }
    }

  private:
    goby::middleware::frontseat::protobuf::NodeStatus latest_node_status_;
    jaiabot::protobuf::BotStatus latest_bot_status_;
    goby::time::SteadyClock::time_point last_health_report_time_{std::chrono::seconds(0)};

    WMM wmm;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Fusion>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Fusion>(argc, argv));
}

jaiabot::apps::Fusion::Fusion() : ApplicationBase(2 * si::hertz)
{
    init_node_status();
    init_bot_status();

    interprocess().subscribe<goby::middleware::groups::gpsd::att>(
        [this](const goby::middleware::protobuf::gpsd::Attitude& att) {
            glog.is_debug1() && glog << "Received Attitude update: " << att.ShortDebugString()
                                     << std::endl;
            if (att.has_pitch())
            {
                auto pitch = att.pitch_with_units();
                latest_node_status_.mutable_pose()->set_pitch_with_units(pitch);
                latest_bot_status_.mutable_attitude()->set_pitch_with_units(pitch);
            }

            if (att.has_heading())
            {
                auto magneticDeclination = wmm.magneticDeclination(
                    latest_node_status_.global_fix().lon(), latest_node_status_.global_fix().lat());
                glog.is_debug2() &&
                    glog << "Location: " << latest_node_status_.global_fix().ShortDebugString()
                         << "  Magnetic declination: " << magneticDeclination << endl;
                auto heading =
                    att.heading_with_units() + magneticDeclination * boost::units::degree::degrees;
                latest_node_status_.mutable_pose()->set_heading_with_units(heading);
                latest_bot_status_.mutable_attitude()->set_heading_with_units(heading);
            }

            if (att.has_roll())
            {
                auto roll = att.roll_with_units();
                latest_node_status_.mutable_pose()->set_roll_with_units(roll);
                latest_bot_status_.mutable_attitude()->set_roll_with_units(roll);
            }
        });
    interprocess().subscribe<groups::imu>([this](const jaiabot::protobuf::IMUData& imu_data) {
        glog.is_debug1() && glog << "Received Attitude update from IMU: "
                                 << imu_data.ShortDebugString() << std::endl;

        auto euler_angles = imu_data.euler_angles();

        if (euler_angles.has_alpha())
        {
            using boost::units::degree::degrees;

            // This produces a heading that is off by 180 degrees, so we need to rotate it
            auto heading = euler_angles.alpha_with_units() + 270 * degrees;
            if (heading > 360 * degrees)
            {
                heading -= (360 * degrees);
            }

            // Apply magnetic declination
            auto magneticDeclination = wmm.magneticDeclination(
                latest_node_status_.global_fix().lon(), latest_node_status_.global_fix().lat());
            glog.is_debug2() &&
                glog << "Location: " << latest_node_status_.global_fix().ShortDebugString()
                     << "  Magnetic declination: " << magneticDeclination << endl;
            heading = heading + magneticDeclination * degrees;

            latest_node_status_.mutable_pose()->set_heading_with_units(heading);
            latest_bot_status_.mutable_attitude()->set_heading_with_units(heading);
        }

        if (euler_angles.has_gamma())
        {
            auto pitch = euler_angles.gamma_with_units();
            latest_node_status_.mutable_pose()->set_pitch_with_units(pitch);
            latest_bot_status_.mutable_attitude()->set_pitch_with_units(pitch);
        }

        if (euler_angles.has_beta())
        {
            auto roll = euler_angles.beta_with_units();
            latest_node_status_.mutable_pose()->set_roll_with_units(roll);
            latest_bot_status_.mutable_attitude()->set_roll_with_units(roll);
        }
    });
    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            glog.is_debug1() && glog << "Received TimePositionVelocity update: "
                                     << tpv.ShortDebugString() << std::endl;

            if (tpv.has_location())
            {
                auto lat = tpv.location().lat_with_units(), lon = tpv.location().lon_with_units();
                latest_node_status_.mutable_global_fix()->set_lat_with_units(lat);
                latest_node_status_.mutable_global_fix()->set_lon_with_units(lon);

                latest_bot_status_.mutable_location()->set_lat_with_units(lat);
                latest_bot_status_.mutable_location()->set_lon_with_units(lon);

                if (has_geodesy())
                {
                    auto xy =
                        geodesy().convert({latest_node_status_.global_fix().lat_with_units(),
                                           latest_node_status_.global_fix().lon_with_units()});
                    latest_node_status_.mutable_local_fix()->set_x_with_units(xy.x);
                    latest_node_status_.mutable_local_fix()->set_y_with_units(xy.y);
                }
            }

            if (tpv.has_speed())
            {
                auto speed = tpv.speed_with_units();
                latest_node_status_.mutable_speed()->set_over_ground_with_units(speed);
                latest_bot_status_.mutable_speed()->set_over_ground_with_units(speed);
            }

            if (tpv.has_track())
            {
                auto track = tpv.track_with_units();
                latest_node_status_.mutable_pose()->set_course_over_ground_with_units(track);
                latest_bot_status_.mutable_attitude()->set_course_over_ground_with_units(track);
            }

            // publish the latest status message with each GPS update
            if (tpv.has_time())
            {
                auto time = tpv.time_with_units();
                latest_node_status_.set_time_with_units(time);
            }
            else
            {
                auto time = goby::time::SystemClock::now<goby::time::MicroTime>();
                latest_node_status_.set_time_with_units(time);
            }

            if (latest_node_status_.IsInitialized())
            {
                interprocess().publish<goby::middleware::frontseat::groups::node_status>(
                    latest_node_status_);
            }
        });

    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pt) {
            auto depth = goby::util::seawater::depth(
                pt.pressure_with_units(), latest_node_status_.global_fix().lat_with_units());

            latest_node_status_.mutable_global_fix()->set_depth_with_units(depth);
            latest_node_status_.mutable_local_fix()->set_z_with_units(
                -latest_node_status_.global_fix().depth_with_units());
            latest_bot_status_.set_depth_with_units(depth);

            if (pt.has_temperature())
            {
                latest_bot_status_.set_temperature_with_units(pt.temperature_with_units());
            }
        });

    interprocess().subscribe<jaiabot::groups::arduino>(
        [this](const jaiabot::protobuf::ArduinoResponse& arduino_response) {
            if (arduino_response.has_thermocouple_temperature_c())
            {
                latest_bot_status_.set_thermocouple_temperature(
                    arduino_response.thermocouple_temperature_c());
            }

            //takes data from one message to the next (clarified by different names)
            if (arduino_response.has_vccvoltage())
            {
                latest_bot_status_.set_vcc_voltage(arduino_response.vccvoltage());
            }

            if (arduino_response.has_vcccurrent())
            {
                latest_bot_status_.set_vcc_current(arduino_response.vcccurrent());
            }

            if (arduino_response.has_vvcurrent())
            {
                latest_bot_status_.set_vv_current(arduino_response.vvcurrent());
            }
        });

    interprocess().subscribe<jaiabot::groups::mission_report>(
        [this](const protobuf::MissionReport& report) {
            latest_bot_status_.set_mission_state(report.state());
            if (report.has_active_goal())
                latest_bot_status_.set_active_goal(report.active_goal());
            else
                latest_bot_status_.clear_active_goal();
        });

    interprocess().subscribe<jaiabot::groups::salinity>(
        [this](const jaiabot::protobuf::SalinityData& salinityData) {
            glog.is_debug1() && glog << "=> " << salinityData.ShortDebugString() << std::endl;
            latest_bot_status_.set_salinity(salinityData.salinity());
        });

    interprocess().subscribe<goby::middleware::groups::health_report>(
        [this](const goby::middleware::protobuf::VehicleHealth& vehicle_health) {
            last_health_report_time_ = goby::time::SteadyClock::now();
            latest_bot_status_.set_health_state(vehicle_health.state());
            latest_bot_status_.clear_error();
            latest_bot_status_.clear_warning();

            if (vehicle_health.state() != goby::middleware::protobuf::HEALTH__OK)
            {
                auto add_errors_and_warnings =
                    [this](const goby::middleware::protobuf::ThreadHealth& health)
                {
                    const auto& jaiabot_health =
                        health.GetExtension(jaiabot::protobuf::jaiabot_thread);
                    for (auto error : jaiabot_health.error())
                        latest_bot_status_.add_error(static_cast<jaiabot::protobuf::Error>(error));
                    for (auto warning : jaiabot_health.warning())
                        latest_bot_status_.add_warning(
                            static_cast<jaiabot::protobuf::Warning>(warning));
                };

                for (const auto& proc : vehicle_health.process())
                {
                    add_errors_and_warnings(proc.main());
                    for (const auto& thread : proc.main().child()) add_errors_and_warnings(thread);
                }

                const int max_errors = protobuf::BotStatus::descriptor()
                                           ->FindFieldByName("error")
                                           ->options()
                                           .GetExtension(dccl::field)
                                           .max_repeat();

                const int max_warnings = protobuf::BotStatus::descriptor()
                                             ->FindFieldByName("warning")
                                             ->options()
                                             .GetExtension(dccl::field)
                                             .max_repeat();

                if (latest_bot_status_.error_size() > max_errors)
                {
                    latest_bot_status_.mutable_error()->Truncate(max_errors - 1);
                    latest_bot_status_.add_error(protobuf::ERROR__TOO_MANY_ERRORS_TO_REPORT_ALL);
                }
                if (latest_bot_status_.warning_size() > max_warnings)
                {
                    latest_bot_status_.mutable_warning()->Truncate(max_warnings - 1);
                    latest_bot_status_.add_warning(
                        protobuf::WARNING__TOO_MANY_WARNINGS_TO_REPORT_ALL);
                }
            }
        });

    // subscribe for commands, to set last_command_time
    interprocess().subscribe<jaiabot::groups::engineering_command>(
        [this](const jaiabot::protobuf::Engineering& command) {
            glog.is_debug1() && glog << "=> " << command.ShortDebugString() << std::endl;

            latest_bot_status_.set_last_command_time_with_units(command.time_with_units());
        });
}

void jaiabot::apps::Fusion::init_node_status()
{
    // set empty pose field so NodeStatus gets generated even without pitch, heading, or roll data
    latest_node_status_.mutable_pose();
}

void jaiabot::apps::Fusion::init_bot_status() { latest_bot_status_.set_bot_id(cfg().bot_id()); }

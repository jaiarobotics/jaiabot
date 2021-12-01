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

#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

using goby::glog;
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
        auto time = goby::time::SystemClock::now<goby::time::MicroTime>();
        latest_bot_status_.set_time_with_units(time);

        if (latest_bot_status_.IsInitialized())
            intervehicle().publish<jaiabot::groups::bot_status>(latest_bot_status_);
    }

  private:
    goby::middleware::frontseat::protobuf::NodeStatus latest_node_status_;
    jaiabot::protobuf::BotStatus latest_bot_status_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Fusion>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Fusion>(argc, argv));
}

jaiabot::apps::Fusion::Fusion() : ApplicationBase(1.0 * si::hertz)
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
                auto heading = att.heading_with_units();
                latest_node_status_.mutable_pose()->set_heading_with_units(heading);
                latest_bot_status_.mutable_attitude()->set_heading_with_units(heading);
            }

            if (att.has_roll())
            {
                auto roll = att.heading_with_units();
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
                interprocess().publish<goby::middleware::frontseat::groups::node_status>(
                    latest_node_status_);
        });

    interprocess().subscribe<jaiabot::groups::mission_report>(
        [this](const protobuf::MissionReport& report) {
            latest_bot_status_.set_mission_state(report.state());
        });
}

void jaiabot::apps::Fusion::init_node_status()
{
    // TODO: placeholder, replace with data from pressure sensor
    latest_node_status_.mutable_global_fix()->set_depth(0);
    latest_node_status_.mutable_local_fix()->set_z_with_units(
        -latest_node_status_.global_fix().depth_with_units());

    // set empty pose field so NodeStatus gets generated even without pitch, heading, or roll data
    latest_node_status_.mutable_pose();
}

void jaiabot::apps::Fusion::init_bot_status() { latest_bot_status_.set_bot_id(cfg().bot_id()); }

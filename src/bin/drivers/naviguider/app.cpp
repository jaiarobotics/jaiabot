// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matthew Ferro <matt.ferro@jaia.tech>
//
//
// This file is part of the JaiaBot Hydro Project Binaries
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

#include <numeric>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>
#include <iostream>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/moos.pb.h"

using goby::glog;
using namespace std;

namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group imu_udp_in{"imu_udp_in"};
constexpr goby::middleware::Group imu_udp_out{"imu_udp_out"};

class NaviguiderPublisher : public zeromq::MultiThreadApplication<config::NaviguiderPublisher>
{
  public:
    NaviguiderPublisher();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    dccl::Codec dccl_;
    goby::time::SteadyClock::time_point last_naviguider_report_time_{std::chrono::seconds(0)};
    bool helm_ivp_in_mission_{false};
    goby::time::SteadyClock::time_point last_imu_trigger_issue_time_{
        goby::time::SteadyClock::now()};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::NaviguiderPublisher>(
        goby::middleware::ProtobufConfigurator<config::NaviguiderPublisher>(argc, argv));
}

// Main thread

double loop_freq = 10;

jaiabot::apps::NaviguiderPublisher::NaviguiderPublisher()
    : zeromq::MultiThreadApplication<config::NaviguiderPublisher>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<imu_udp_in, imu_udp_out>;
    launch_thread<GPSUDPThread>(cfg().udp_config());

    interthread().subscribe<imu_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        // Deserialize from the UDP packet
        jaiabot::protobuf::IMUData imu_data;
        if (!imu_data.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize IMUData from the UDP packet" << endl;
            return;
        }

        glog.is_debug2() && glog << "Publishing IMU data: " << imu_data.ShortDebugString() << endl;

        if (imu_data.is_secondary())
        {
            interprocess().publish<groups::imu_secondary>(imu_data);
        }
        else
        {
            interprocess().publish<groups::imu>(imu_data);
        }

        last_naviguider_report_time_ = goby::time::SteadyClock::now();
    });

    interprocess().subscribe<jaiabot::groups::moos>([this](const protobuf::MOOSMessage& moos_msg) {
        if (moos_msg.key() == "JAIABOT_MISSION_STATE")
        {
            if (moos_msg.svalue() == "IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT")
            {
                helm_ivp_in_mission_ = true;
            }
            else
            {
                helm_ivp_in_mission_ = false;
            }
        }
    });

    interprocess().subscribe<jaiabot::groups::imu>([this](const protobuf::IMUCommand& imu_command) {
        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(imu_command.SerializeAsString());
        interthread().publish<imu_udp_out>(io_data);

        glog.is_debug1() && glog << "Sending IMUCommand: " << imu_command.ShortDebugString()
                                 << endl;
    });
}

void jaiabot::apps::NaviguiderPublisher::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    auto command = jaiabot::protobuf::IMUCommand();
    command.set_type(jaiabot::protobuf::IMUCommand::TAKE_READING);

    io_data->set_data(command.SerializeAsString());
    interthread().publish<imu_udp_out>(io_data);

    glog.is_debug2() && glog << "Requesting IMUData from python driver" << endl;
}

void jaiabot::apps::NaviguiderPublisher::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the adafruit_BNO085 is responding
    if (cfg().naviguider_report_in_simulation())
    {
        if (helm_ivp_in_mission_)
        {
            glog.is_debug1() &&
                glog << "Simulation Sensor Check (TODO: add simulation for this sensor)"
                     << std::endl;
            //TODO: add simulation for this sensor
            //check_last_report(health, health_state);
        }
    }
    else
    {
        check_last_report(health, health_state);
    }

    health.set_state(health_state);
}

void jaiabot::apps::NaviguiderPublisher::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_naviguider_report_time_ +
            std::chrono::seconds(cfg().naviguider_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on naviguider" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_NAVIGUIDER_DRIVER);

        // Wait a certain amount of time before publishing issue
        if (last_imu_trigger_issue_time_ +
                std::chrono::seconds(cfg().imu_trigger_issue_timeout_seconds()) <
            goby::time::SteadyClock::now())
        {
            jaiabot::protobuf::IMUIssue imu_issue;
            imu_issue.set_solution(cfg().imu_issue_solution());
            interprocess().publish<jaiabot::groups::imu>(imu_issue);
            last_imu_trigger_issue_time_ = goby::time::SteadyClock::now();
        }
    }
}

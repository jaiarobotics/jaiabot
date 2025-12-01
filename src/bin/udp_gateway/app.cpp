// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Edited by Ed Sanville <edsanville@gmail.com>
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

#include "bin/udp_gateway/config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"
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
constexpr goby::middleware::Group udp_gateway_in{"udp_gateway_in"};
constexpr goby::middleware::Group udp_gateway_out{"udp_gateway_out"};

class UDPGateway
    : public zeromq::MultiThreadApplication<config::UDPGateway>
{
  public:
    UDPGateway();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

    void send_imu_command(const jaiabot::protobuf::IMUCommand& imu_command);
    void send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope);

    void received_imu_data(const jaiabot::protobuf::IMUData& imu_data);
    void received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope);

  private:
    dccl::Codec dccl_;
    goby::time::SteadyClock::time_point last_imu_data_time_{std::chrono::seconds(0)};
    bool helm_ivp_in_mission_{false};
    goby::time::SteadyClock::time_point last_imu_trigger_issue_time_{
        goby::time::SteadyClock::now()};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::UDPGateway>(
        goby::middleware::ProtobufConfigurator<config::UDPGateway>(argc, argv));
}

// Main thread

double loop_freq = 10;

jaiabot::apps::UDPGateway::UDPGateway()
    : zeromq::MultiThreadApplication<config::UDPGateway>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using UDPThread = goby::middleware::io::UDPPointToPointThread<udp_gateway_in, udp_gateway_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    interthread().subscribe<udp_gateway_in>(
        [this](const goby::middleware::protobuf::IOData& data)
        {
            // Deserialize from the UDP packet
            
            jaiabot::protobuf::UDPGatewayEnvelope envelope;
            if (!envelope.ParseFromString(data.data()))
            {
                glog.is_warn() && glog << "Couldn't deserialize UDPGatewayEnvelope from the UDP packet"
                                       << endl;
                return;
            }

            received_envelope(envelope);

        });

    interprocess().subscribe<jaiabot::groups::moos>(
        [this](const protobuf::MOOSMessage& moos_msg)
        {
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

    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const protobuf::IMUCommand& imu_command)
        {
            send_imu_command(imu_command);
        });
}



void jaiabot::apps::UDPGateway::send_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope) {
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data(envelope.SerializeAsString());
    interthread().publish<udp_gateway_out>(io_data);

    glog.is_debug2() && glog << "Sent UDPGatewayEnvelope: " << envelope.ShortDebugString()
                             << endl;
}


void jaiabot::apps::UDPGateway::send_imu_command(const jaiabot::protobuf::IMUCommand& imu_command) {
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    *envelope.mutable_imu_command() = imu_command;
    send_envelope(envelope);
}


void jaiabot::apps::UDPGateway::received_imu_data(const jaiabot::protobuf::IMUData& imu_data) {
    glog.is_debug2() && glog << "Received IMUData: " << imu_data.ShortDebugString()
                             << endl;
    interprocess().publish<groups::imu>(imu_data);
    last_imu_data_time_ = goby::time::SteadyClock::now();
}


void jaiabot::apps::UDPGateway::received_envelope(const jaiabot::protobuf::UDPGatewayEnvelope& envelope) {
    switch(envelope.payload_case())
    {
        case jaiabot::protobuf::UDPGatewayEnvelope::kImuData:
        {
            received_imu_data(envelope.imu_data());
            break;
        }
        default:
        {
            glog.is_warn() && glog << "Received unknown payload in UDPGatewayEnvelope"
                                   << endl;
            break;
        }
    }
}


void jaiabot::apps::UDPGateway::loop()
{
    auto command = jaiabot::protobuf::IMUCommand();
    command.set_type(jaiabot::protobuf::IMUCommand::TAKE_READING);
    send_imu_command(command);
}

void jaiabot::apps::UDPGateway::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the IMU is responding
    if (cfg().imu_data_report_in_simulation())
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

void jaiabot::apps::UDPGateway::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_imu_data_time_ +
            std::chrono::seconds(cfg().imu_data_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on IMU data" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_IMU);

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

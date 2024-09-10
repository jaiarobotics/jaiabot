// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Nick Marshall <nick.marshall@jaia.tech>
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
#include "jaiabot/messages/edna_pump.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/health.pb.h"

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
constexpr goby::middleware::Group edna_udp_in{"edna_udp_in"};
constexpr goby::middleware::Group edna_udp_out{"edna_udp_out"};

class eDNAPumpDriver : public zeromq::MultiThreadApplication<config::eDNAPumpDriver>
{
    public:
        eDNAPumpDriver();

    private: 
        void loop() override;
        void health(goby::middleware::protobuf::ThreadHealth& health) override;
        void check_last_report(goby::middleware::protobuf::ThreadHealth& health, goby::middleware::protobuf::HealthState& health_state);

    private:
        goby::time::SteadyClock::time_point last_edna_pump_report_time_{goby::time::SteadyClock::now()};
        goby::time::SteadyClock::time_point last_edna_pump_trigger_issue_time_{goby::time::SteadyClock::now()};
        jaiabot::protobuf::eDNAData latest_edna_pump_data;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[]) 
{
    return goby::run<jaiabot::apps::eDNAPumpDriver>(
        goby::middleware::ProtobufConfigurator<config::eDNAPumpDriver>(argc, argv)
    );
}

// main thread

double loop_freq = 1;

jaiabot::apps::eDNAPumpDriver::eDNAPumpDriver()
    : zeromq::MultiThreadApplication<config::eDNAPumpDriver>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<edna_udp_in, edna_udp_out>;
    launch_thread<GPSUDPThread>(cfg().udp_config());

    interthread().subscribe<edna_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        // Deserialize from UDP packet
        if (!latest_edna_pump_data.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize eDNAData from the UDP packet." << endl;
            return;
        }

        glog.is_debug2() && glog << "Publishing eDNA data: " << latest_edna_pump_data.ShortDebugString() << endl;

        interprocess().publish<groups::edna>(latest_edna_pump_data);
        last_edna_pump_report_time_ = goby::time::SteadyClock::now();
    });

    interprocess().subscribe<jaiabot::groups::edna>(
        [this](const protobuf::eDNACommand& edna_command) {
            auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
            io_data->set_data(edna_command.SerializeAsString());
            interthread().publish<edna_udp_out>(io_data);

            glog.is_debug1() && glog << "Sending eDNACommand: " << edna_command.ShortDebugString() << endl;
        }
    );

    interprocess().subscribe<jaiabot::groups::engineering_command>(
        [this](const jaiabot::protobuf::Engineering& command) {
            if (command.query_engineering_status())
            {
                interprocess().publish<jaiabot::groups::engineering_status>(latest_edna_pump_data);
            }
        }
    );
}

void jaiabot::apps::eDNAPumpDriver::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    auto command = jaiabot::protobuf::eDNACommand();
    command.set_type(jaiabot::protobuf::eDNACommand::CMD_STATUS);

    io_data->set_data(command.SerializeAsString());
    interthread().publish<edna_udp_out>(io_data);

    glog.is_debug2() && glog << "Requesting status from python driver" << endl;
}

void jaiabot::apps::eDNAPumpDriver::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the echo is responding
    if (!cfg().edna_pump_report_in_simulation())
    {
        check_last_report(health, health_state);
    }

    health.set_state(health_state);
}

void jaiabot::apps::eDNAPumpDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_edna_pump_report_time_ + std::chrono::seconds(cfg().edna_pump_report_timeout_seconds()) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on eDNA pump" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_EDNA_PUMP_DRIVER);

        // Wait a certain amount of time before publishing issue
        if (last_edna_pump_trigger_issue_time_ + std::chrono::seconds(cfg().edna_pump_trigger_issue_timeout_seconds()) < goby::time::SteadyClock::now())
        {
            jaiabot::protobuf::eDNAPumpIssue edna_pump_issue;
            edna_pump_issue.set_solution(cfg().edna_pump_issue_solution());
            interprocess().publish<jaiabot::groups::edna>(edna_pump_issue);
            last_edna_pump_trigger_issue_time_ = goby::time::SteadyClock::now();
        }
    }
}
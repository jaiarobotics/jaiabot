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
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/esc_temp.pb.h"
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
constexpr goby::middleware::Group esc_temp_udp_in{"esc_temp_udp_in"};
constexpr goby::middleware::Group esc_temp_udp_out{"esc_temp_udp_out"};

class EscTempDriver : public zeromq::MultiThreadApplication<config::EscTempDriver>
{
  public:
    EscTempDriver();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    goby::time::SteadyClock::time_point last_esc_temp_report_time_{goby::time::SteadyClock::now()};
    goby::time::SteadyClock::time_point last_esc_temp_trigger_issue_time_{
        goby::time::SteadyClock::now()};
    jaiabot::protobuf::esc_temp latest_esc_temp_data;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::EscTempDriver>(
        goby::middleware::ProtobufConfigurator<config::EscTempDriver>(arcc, argv);)
}

double loop_freq = 1;

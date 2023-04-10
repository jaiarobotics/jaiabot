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
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>
#include <goby/middleware/io/udp_point_to_point.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/moos.pb.h"
#include "jaiabot/messages/salinity.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group atlas_salinity_udp_in{"atlas_salinity_udp_in"};
constexpr goby::middleware::Group atlas_salinity_udp_out{"atlas_salinity_udp_out"};

class AtlasSalinityPublisher : public zeromq::MultiThreadApplication<config::AtlasSalinityPublisher>
{
  public:
    AtlasSalinityPublisher();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    dccl::Codec dccl_;
    goby::time::SteadyClock::time_point last_atlas_salinity_report_time_{std::chrono::seconds(0)};
    bool helm_ivp_in_mission_{false};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::AtlasSalinityPublisher>(
        goby::middleware::ProtobufConfigurator<config::AtlasSalinityPublisher>(argc, argv));
}

// Main thread

double loop_freq = 10;

// for string delimiter
std::vector<std::string> split (std::string s, std::string delimiter) {
    size_t pos_start = 0, pos_end, delim_len = delimiter.length();
    std::string token;
    std::vector<std::string> res;

    while ((pos_end = s.find (delimiter, pos_start)) != std::string::npos) {
        token = s.substr (pos_start, pos_end - pos_start);
        pos_start = pos_end + delim_len;
        res.push_back (token);
    }

    res.push_back (s.substr (pos_start));
    return res;
}


jaiabot::apps::AtlasSalinityPublisher::AtlasSalinityPublisher()
    : zeromq::MultiThreadApplication<config::AtlasSalinityPublisher>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using AtlasSalinityUDPThread = goby::middleware::io::UDPPointToPointThread<atlas_salinity_udp_in, atlas_salinity_udp_out>;
    launch_thread<AtlasSalinityUDPThread>(cfg().udp_config());

    interprocess().subscribe<atlas_salinity_udp_in>(
        [this](const goby::middleware::protobuf::IOData& data) {
            auto s = std::string(data.data());
            auto fields = split(s, ",");
            if (fields.size() < 5)
            {
                glog.is_warn() && glog << group("main") << "Did not receive enough fields: " << s
                                       << std::endl;
                return;
            }

            int index = 0;

            auto date_string = fields[index++];

            jaiabot::protobuf::SalinityData output;

            output.set_conductivity(std::stod(fields[index++]));
            output.set_total_dissolved_solids(std::stod(fields[index++]));
            output.set_salinity(std::stod(fields[index++]));
            output.set_specific_gravity(std::stod(fields[index++]));

            glog.is_debug1() && glog << "=> " << output.ShortDebugString() << std::endl;

            interprocess().publish<groups::salinity>(output);

            last_atlas_salinity_report_time_ = goby::time::SteadyClock::now();
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
}

void jaiabot::apps::AtlasSalinityPublisher::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<atlas_salinity_udp_out>(io_data);
}

void jaiabot::apps::AtlasSalinityPublisher::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the atlas_salinity is responding
    if (cfg().atlas_salinity_report_in_simulation())
    {
        if (helm_ivp_in_mission_)
        {
            glog.is_debug1() && glog << "Simulation Sensor Check" << std::endl;
            check_last_report(health, health_state);
        }
    }
    else
    {
        check_last_report(health, health_state);
    }

    health.set_state(health_state);
}

void jaiabot::apps::AtlasSalinityPublisher::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_atlas_salinity_report_time_ +
            std::chrono::seconds(cfg().atlas_salinity_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on atlas_salinity" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER);
    }
}

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
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/moos/middleware/moos_plugin_translator.h>
#include <goby/moos/protobuf/desired_course.pb.h>
#include <goby/util/linebasedcomms/gps_sentence.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/example.pb.h"

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
constexpr goby::middleware::Group udp_in{"udp_in"};
constexpr goby::middleware::Group udp_out{"udp_out"};

class SimulatorTranslation : public goby::moos::Translator
{
  public:
    SimulatorTranslation(const goby::apps::moos::protobuf::GobyMOOSGatewayConfig& cfg)
        : goby::moos::Translator(cfg)
    {
        namespace degree = boost::units::degree;
        using boost::units::quantity;

        std::vector<std::string> nav_buffer_params(
            {"LAT", "LONG", "DEPTH", "SPEED", "ROLL", "PITCH", "HEADING", "HEADING_OVER_GROUND"});
        for (const auto& var : nav_buffer_params) moos().add_buffer("NAV_" + var);
        moos().add_trigger("NAV_SPEED", [this](const CMOOSMsg& msg) {
            auto& moos_buffer = moos().buffer();

            goby::util::gps::RMC rmc;
            goby::util::gps::HDT hdt;

            rmc.status = goby::util::gps::RMC::DataValid;
            rmc.latitude = moos_buffer["NAV_LAT"].GetDouble() * degree::degree;
            rmc.longitude = moos_buffer["NAV_LONG"].GetDouble() * degree::degree;

            rmc.speed_over_ground =
                quantity<si::velocity>(moos_buffer["NAV_SPEED"].GetDouble() * si::meter_per_second);

            rmc.course_over_ground =
                moos_buffer["NAV_HEADING_OVER_GROUND"].GetDouble() * degree::degree;

            hdt.true_heading = moos_buffer["NAV_HEADING"].GetDouble() * degree::degrees;
            {
                auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
                io_data->set_data(rmc.serialize().message_cr_nl());
                interthread().publish<udp_out>(io_data);
            }

            {
                auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
                io_data->set_data(hdt.serialize().message_cr_nl());
                interthread().publish<udp_out>(io_data);
            }
        });

        goby()
            .interprocess()
            .subscribe<goby::middleware::frontseat::groups::desired_course,
                       goby::middleware::frontseat::protobuf::DesiredCourse,
                       goby::middleware::MarshallingScheme::PROTOBUF>(
                [this](
                    const goby::middleware::frontseat::protobuf::DesiredCourse& desired_setpoints) {
                    glog.is_debug1() && glog << "Received desired course: "
                                             << desired_setpoints.ShortDebugString() << std::endl;

                    moos().comms().Notify("DESIRED_HEADING", desired_setpoints.heading());
                    moos().comms().Notify("DESIRED_SPEED", desired_setpoints.speed());
                    moos().comms().Notify("DESIRED_DEPTH", desired_setpoints.depth());

                    static bool override_posted = false;
                    if (!override_posted)
                    {
                        moos().comms().Notify("MOOS_MANUAL_OVERRIDE", "false");
                        override_posted = true;
                    }
                });
    }
};

class Simulator : public zeromq::MultiThreadApplication<config::Simulator>
{
  public:
    Simulator();
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Simulator>(
        goby::middleware::ProtobufConfigurator<config::Simulator>(argc, argv));
}

// Main thread
jaiabot::apps::Simulator::Simulator()
{
    glog.add_group("main", goby::util::Colors::yellow);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<udp_in, udp_out>;
    launch_thread<GPSUDPThread>(cfg().gps_udp_config());

    goby::apps::moos::protobuf::GobyMOOSGatewayConfig sim_cfg;
    *sim_cfg.mutable_app() = cfg().app();
    *sim_cfg.mutable_interprocess() = cfg().interprocess();
    *sim_cfg.mutable_moos() = cfg().moos();
    launch_thread<jaiabot::apps::SimulatorTranslation>(sim_cfg);
}

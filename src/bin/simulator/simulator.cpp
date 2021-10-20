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
#include <goby/middleware/navigation/navigation.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/moos/middleware/moos_plugin_translator.h>
#include <goby/util/linebasedcomms/gps_sentence.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/high_control.pb.h"

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
        interprocess().subscribe<goby::middleware::groups::datum_update>(
            [this](const goby::middleware::protobuf::DatumUpdate& datum_update) {
                geodesy_.reset(new goby::util::UTMGeodesy({datum_update.datum().lat_with_units(),
                                                           datum_update.datum().lon_with_units()}));
            });

        namespace degree = boost::units::degree;
        using boost::units::quantity;

        std::vector<std::string> nav_buffer_params(
            {"X", "Y", "DEPTH", "SPEED", "ROLL", "PITCH", "HEADING", "HEADING_OVER_GROUND"});
        for (const auto& var : nav_buffer_params) moos().add_buffer("NAV_" + var);
        moos().add_trigger("NAV_SPEED", [this](const CMOOSMsg& msg) {
            if (!geodesy_)
                return;

            auto& moos_buffer = moos().buffer();

            goby::util::gps::RMC rmc;
            goby::util::gps::HDT hdt;

            rmc.status = goby::util::gps::RMC::DataValid;
            auto x = moos_buffer["NAV_X"].GetDouble() * boost::units::si::meters;
            auto y = moos_buffer["NAV_Y"].GetDouble() * boost::units::si::meters;

            auto latlon = geodesy_->convert({x, y});

            rmc.latitude = latlon.lat;
            rmc.longitude = latlon.lon;

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

        goby().interprocess().subscribe<groups::desired_setpoints>(
            [this](const protobuf::DesiredSetpoints& desired_setpoints) {
                moos().comms().Notify("MOOS_MANUAL_OVERRIDE", "false");

                switch (desired_setpoints.type())
                {
                    case protobuf::SETPOINT_IVP_HELM:
                    {
                        glog.is_debug1() &&
                            glog << "Received desired course: "
                                 << desired_setpoints.helm_course().ShortDebugString() << std::endl;

                        moos().comms().Notify("DESIRED_HEADING",
                                              desired_setpoints.helm_course().heading());
                        moos().comms().Notify("DESIRED_SPEED",
                                              desired_setpoints.helm_course().speed());
                        moos().comms().Notify("DESIRED_DEPTH",
                                              desired_setpoints.helm_course().depth());
                    }

                    break;

                    case protobuf::SETPOINT_STOP:
                        moos().comms().Notify("DESIRED_HEADING", 0.0);
                        moos().comms().Notify("DESIRED_SPEED", 0.0);
                        moos().comms().Notify("DESIRED_DEPTH", 0.0);
                        break;

                    case protobuf::SETPOINT_REMOTE_CONTROL:
                        // unimplemented
                        break;

                    case protobuf::SETPOINT_DIVE:
                        // unimplemented
                        break;

                    case protobuf::SETPOINT_POWERED_ASCENT:
                        moos().comms().Notify("DESIRED_HEADING", 0.0);

                        // some high value for the simulator. real controller will presumably set some fixed RPM
                        moos().comms().Notify("DESIRED_SPEED", 5.0);
                        moos().comms().Notify("DESIRED_DEPTH", 0.0);
                        break;
                }
            });
    }

  private:
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
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

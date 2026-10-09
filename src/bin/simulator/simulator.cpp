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

#include <boost/units/io.hpp>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/navigation/navigation.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/moos/middleware/moos_plugin_translator.h>
#include <goby/time/convert.h>
#include <goby/time/steady_clock.h>
#include <goby/time/types.h>
#include <goby/util/sci.h>
#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/control_surfaces.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/low_control.pb.h"
#include "jaiabot/messages/simulator.pb.h"

#include "arduino_sim_thread.h"
#include "bar30_sim_thread.h"
#include "config.pb.h"
#include "dive_sim_thread.h"
#include "ezo_ec_sim_thread.h"
#include "gps_sim_thread.h"
#include "hub_sim_thread.h"
#include "imu_sim_thread.h"
#include "oceanographic_sim_thread.h"
#include "simulator_thread.h"
#include "storm_sim_thread.h"

#include <goby/middleware/io/cobs/pty.h>

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;
using boost::units::quantity;
namespace degree = boost::units::degree;

namespace jaiabot
{
namespace apps
{

class SimulatorTranslation : public goby::moos::Translator
{
  public:
    SimulatorTranslation(
        const std::pair<goby::apps::moos::protobuf::GobyMOOSGatewayConfig, config::Simulator>& cfg);

  private:
    void process_nav(const CMOOSMsg& msg);
    void process_desired_setpoints(const protobuf::DesiredSetpoints& desired_setpoints);
    void process_control_surfaces(const protobuf::ControlSurfaces& control_surfaces);

    template <const goby::middleware::Group& in_nav> void subscribe_to_add_latlon_to_nav()
    {
        goby().interthread().subscribe<in_nav>(
            [this](std::shared_ptr<const SimNav> dv_nav)
            {
                auto nav = std::make_shared<SimNav>(*dv_nav);

                nav->latlon = geodesy_->convert({dv_nav->x, dv_nav->y});

                glog.is_debug1() && glog << group("translation")
                                         << std::setprecision(std::numeric_limits<double>::digits10)
                                         << "[sim nav] lat: " << nav->latlon.lat
                                         << ", lon: " << nav->latlon.lon << std::endl;

                goby().interthread().publish<sim_nav>(nav);
            });
    }

  private:
    const config::Simulator& sim_cfg_;
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;

    goby::time::SteadyClock::time_point stop_forward_progress_end_{std::chrono::seconds(0)};

    bool making_forward_progress_{false};
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
    if (cfg().node_type() == jaiabot::protobuf::BOT)
    {
        // gps
        using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<gps_udp_in, gps_udp_out>;
        if (cfg().gps_config().enable_gps())
        {
            launch_thread<GPSUDPThread>(cfg().gps_config().udp_config());
            launch_thread<GPSSimThread>(cfg().gps_config());
        }

        switch (cfg().bot_type())
        {
            case protobuf::STORM:
                using MCUPtyThread = goby::middleware::io::PTYThreadCOBS<
                    groups::storm_mcu_serial_in, groups::storm_mcu_serial_out,
                    goby::middleware::io::PubSubLayer::INTERTHREAD,
                    goby::middleware::io::PubSubLayer::INTERTHREAD>;
                launch_thread<MCUPtyThread>(cfg().storm_config().mcu_pty());
                launch_thread<StormSimThread>(cfg().storm_config());
                break;

            default: break;
        }

        // imu
        launch_thread<IMUSimThread>(cfg().imu_config());

        // dive sim
        launch_thread<DiveSimThread>(cfg().dive_config());

        // oceanographic sensors
        using GatewayUDPThread =
            goby::middleware::io::UDPPointToPointThread<gateway_udp_in, gateway_udp_out>;
        launch_thread<GatewayUDPThread>(cfg().udp_gateway_config());
        launch_thread<OceanographicSimThread>(cfg().oceanographic_config());
        launch_thread<Bar30SimThread>(cfg().bar30_config());
        launch_thread<EzoECSimThread>(cfg().ezo_ec_config());

        // arduino
        launch_thread<ArduinoSimThread>(cfg().arduino_config());

        goby::apps::moos::protobuf::GobyMOOSGatewayConfig sim_cfg;
        *sim_cfg.mutable_app() = cfg().app();
        *sim_cfg.mutable_interprocess() = cfg().interprocess();
        *sim_cfg.mutable_moos() = cfg().moos();
        // moos sim translation
        launch_thread<jaiabot::apps::SimulatorTranslation>(std::make_pair(sim_cfg, cfg()));
    }
    else if (cfg().node_type() == jaiabot::protobuf::HUB)
    {
        // hub position
        launch_thread<HubSimThread>(cfg());
    }
}

// Translation thread
jaiabot::apps::SimulatorTranslation::SimulatorTranslation(
    const std::pair<goby::apps::moos::protobuf::GobyMOOSGatewayConfig, config::Simulator>& cfg)
    : goby::moos::Translator(cfg.first),
      sim_cfg_(cfg.second),
      geodesy_(new goby::util::UTMGeodesy(
          {sim_cfg_.start_location().lat_with_units(), sim_cfg_.start_location().lon_with_units()}))

{
    glog.add_group("translation", goby::util::Colors::yellow);

    goby().interthread().subscribe<to_moos>([this](const std::pair<std::string, std::string>& pub)
                                            { moos().comms().Notify(pub.first, pub.second); });

    switch (sim_cfg_.bot_type())
    {
        case protobuf::STORM: subscribe_to_add_latlon_to_nav<storm_nav>(); break;
        default: subscribe_to_add_latlon_to_nav<dive_nav>(); break;
    }

    if (sim_cfg_.node_type() == jaiabot::protobuf::BOT)
    {
        interprocess().subscribe<goby::middleware::groups::datum_update>(
            [this](const goby::middleware::protobuf::DatumUpdate& datum_update)
            {
                geodesy_.reset(new goby::util::UTMGeodesy({datum_update.datum().lat_with_units(),
                                                           datum_update.datum().lon_with_units()}));
                moos().comms().Notify("USM_RESET", "x=0, y=0, speed=0, heading=0, depth=0");
            });

        std::vector<std::string> nav_buffer_params(
            {"X", "Y", "DEPTH", "SPEED", "ROLL", "PITCH", "HEADING", "HEADING_OVER_GROUND"});
        for (const auto& var : nav_buffer_params) moos().add_buffer("NAV_" + var);
        moos().add_trigger("NAV_SPEED", [this](const CMOOSMsg& msg) { process_nav(msg); });

        goby().interprocess().subscribe<groups::desired_setpoints>(
            [this](const protobuf::DesiredSetpoints& desired_setpoints)
            { process_desired_setpoints(desired_setpoints); });

        goby().interprocess().subscribe<groups::low_control>(
            [this](const jaiabot::protobuf::LowControl& low_control)
            {
                if (low_control.has_control_surfaces())
                    process_control_surfaces(low_control.control_surfaces());
            });

        // Subscribe to engineering commands for:
        // * bounds config changes, so we can bounce the new config back to jaiabot_engineering
        interprocess().subscribe<jaiabot::groups::engineering_command>(
            [this](const jaiabot::protobuf::Engineering& engineering)
            {
                if (engineering.has_bounds())
                {
                    auto bounds = engineering.bounds();
                    // Publish an engineering_status message, so the current bounds can be queried in engineering_status
                    interprocess().publish<jaiabot::groups::engineering_status>(bounds);
                }
            });

        goby().interprocess().subscribe<groups::simulator_command>(
            [this](const jaiabot::protobuf::SimulatorCommand& command)
            {
                switch (command.command_case())
                {
                    case jaiabot::protobuf::SimulatorCommand::kStopForwardProgress:
                        stop_forward_progress_end_ =
                            goby::time::SteadyClock::now() +
                            goby::time::convert_duration<goby::time::SteadyClock::duration>(
                                command.stop_forward_progress().duration_with_units());
                        break;

                    default:
                        // handled in another thread
                        break;
                }
            });

        // Seed once
        std::srand(unsigned(std::time(NULL)));
    }
}

void jaiabot::apps::SimulatorTranslation::process_nav(const CMOOSMsg& msg)
{
    auto now = goby::time::SteadyClock::now();

    if (!geodesy_)
        return;

    auto& moos_buffer = moos().buffer();

    auto x = moos_buffer["NAV_X"].GetDouble() * si::meters;
    auto y = moos_buffer["NAV_Y"].GetDouble() * si::meters;
    auto depth = moos_buffer["NAV_DEPTH"].GetDouble() * si::meters;

    auto speed_over_ground =
        quantity<si::velocity>(moos_buffer["NAV_SPEED"].GetDouble() * si::meter_per_second);
    auto course_over_ground = moos_buffer["NAV_HEADING_OVER_GROUND"].GetDouble() * degree::degree;

    auto heading = moos_buffer["NAV_HEADING"].GetDouble() * degree::degrees;
    auto pitch = moos_buffer["NAV_PITCH"].GetDouble() * si::radians;
    if (!making_forward_progress_)
        pitch = sim_cfg_.pitch_at_rest_with_units<decltype(pitch)>();

    auto roll = moos_buffer["NAV_ROLL"].GetDouble() * si::radians;
    auto nav = std::make_shared<SimNav>(
        SimNav({x, y, speed_over_ground, course_over_ground, depth, heading, pitch, roll}));

    glog.is_debug1() && glog << group("translation") << "[moos_nav] x: " << nav->x
                             << ", y: " << nav->y << ", depth: " << nav->depth << std::endl;

    interthread().publish<moos_nav>(nav);
}

void jaiabot::apps::SimulatorTranslation::process_desired_setpoints(
    const protobuf::DesiredSetpoints& desired_setpoints)
{
    switch (desired_setpoints.type())
    {
        // all of these can be handled by uSimMarine directly
        case protobuf::SETPOINT_IVP_HELM:
        case protobuf::SETPOINT_STOP:
        case protobuf::SETPOINT_POWERED_ASCENT:
        case protobuf::SETPOINT_REMOTE_CONTROL:
        case protobuf::SETPOINT_SUSPEND_PID:
            moos().comms().Notify("MOOS_MANUAL_OVERRIDE", "false");
            break;

            // handled by depth thread by resetting uSimMarine
        case protobuf::SETPOINT_DIVE: moos().comms().Notify("MOOS_MANUAL_OVERRIDE", "true"); break;
    }
}

void jaiabot::apps::SimulatorTranslation::process_control_surfaces(
    const protobuf::ControlSurfaces& control_surfaces)
{
    // both uSimMarine and BotPidControl use -100 -> 100 scale for these control surfaces so no normalization is required
    constexpr double thrust_normalization = 1.0;
    constexpr double rudder_normalization = 1.0;
    constexpr double elevator_normalization = 1.0;

    auto normalized_thrust = thrust_normalization * control_surfaces.motor();

    bool is_no_forward_progress = goby::time::SteadyClock::now() <= stop_forward_progress_end_;
    making_forward_progress_ = true;
    if (std::abs(normalized_thrust) < sim_cfg_.minimum_thrust() || is_no_forward_progress)
    {
        making_forward_progress_ = false;
        normalized_thrust = 0;
    }

    moos().comms().Notify("DESIRED_THRUST", normalized_thrust);
    moos().comms().Notify("DESIRED_RUDDER", rudder_normalization * control_surfaces.rudder());
    moos().comms().Notify(
        "DESIRED_ELEVATOR",
        elevator_normalization *
            (control_surfaces.port_elevator() + control_surfaces.stbd_elevator()) / 2);
}

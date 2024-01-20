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

#include <random>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include "simulator_thread.h"
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/navigation/navigation.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/moos/middleware/moos_plugin_translator.h>
#include <goby/time/convert.h>
#include <goby/time/steady_clock.h>
#include <goby/time/types.h>
#include <goby/util/linebasedcomms/gps_sentence.h>
#include <goby/util/sci.h>
#include <goby/util/seawater.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/control_surfaces.pb.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/low_control.pb.h"
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

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
constexpr goby::middleware::Group gps_udp_in{"gps_udp_in"};
constexpr goby::middleware::Group gps_udp_out{"gps_udp_out"};

constexpr goby::middleware::Group pressure_udp_in{"pressure_udp_in"};
constexpr goby::middleware::Group pressure_udp_out{"pressure_udp_out"};

constexpr goby::middleware::Group salinity_udp_in{"salinity_udp_in"};
constexpr goby::middleware::Group salinity_udp_out{"salinity_udp_out"};

class SimulatorTranslation : public goby::moos::Translator
{
  public:
    SimulatorTranslation(
        const std::pair<goby::apps::moos::protobuf::GobyMOOSGatewayConfig, config::Simulator>& cfg);

  private:
    void process_nav(const CMOOSMsg& msg);
    void process_desired_setpoints(const protobuf::DesiredSetpoints& desired_setpoints);
    void process_control_surfaces(const protobuf::ControlSurfaces& control_surfaces);
    void sim_hub_status();

  private:
    const config::Simulator& sim_cfg_;
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
    protobuf::DesiredSetpoints last_setpoints_;

    quantity<si::length> dive_x_, dive_y_, dive_depth_;
    goby::time::SteadyClock::time_point last_nav_process_time_;

    std::map<quantity<si::length>, double> temperature_degC_profile_;
    std::map<quantity<si::length>, double> salinity_profile_;

    std::default_random_engine generator_;
    std::normal_distribution<double> temperature_distribution_;
    std::normal_distribution<double> salinity_distribution_;
    goby::time::SteadyClock::time_point sky_last_updated_{std::chrono::seconds(0)};
    int time_out_sky_{200};
    double hdop_rand_max_{1};
    double pdop_rand_max_{1.5};
    double heading_rand_max_{0};
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

    if (cfg().is_bot_sim())
    {
        using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<gps_udp_in, gps_udp_out>;
        if (cfg().enable_gps())
            launch_thread<GPSUDPThread>(cfg().gps_udp_config());

        using PressureUDPThread =
            goby::middleware::io::UDPPointToPointThread<pressure_udp_in, pressure_udp_out>;
        launch_thread<PressureUDPThread>(cfg().pressure_udp_config());

        using SalinityUDPThread =
            goby::middleware::io::UDPPointToPointThread<salinity_udp_in, salinity_udp_out>;
        launch_thread<SalinityUDPThread>(cfg().salinity_udp_config());

        launch_thread<ArduinoSimThread>(cfg().arduino_config());
    }

    goby::apps::moos::protobuf::GobyMOOSGatewayConfig sim_cfg;
    *sim_cfg.mutable_app() = cfg().app();
    *sim_cfg.mutable_interprocess() = cfg().interprocess();
    *sim_cfg.mutable_moos() = cfg().moos();
    launch_thread<jaiabot::apps::SimulatorTranslation>(std::make_pair(sim_cfg, cfg()));
}

// Translation thread
jaiabot::apps::SimulatorTranslation::SimulatorTranslation(
    const std::pair<goby::apps::moos::protobuf::GobyMOOSGatewayConfig, config::Simulator>& cfg)
    : goby::moos::Translator(cfg.first),
      sim_cfg_(cfg.second),
      geodesy_(new goby::util::UTMGeodesy({sim_cfg_.start_location().lat_with_units(),
                                           sim_cfg_.start_location().lon_with_units()})),
      temperature_distribution_(0, sim_cfg_.temperature_stdev()),
      salinity_distribution_(0, sim_cfg_.salinity_stdev())

{
    if (sim_cfg_.is_bot_sim())
    {
        interprocess().subscribe<goby::middleware::groups::datum_update>(
            [this](const goby::middleware::protobuf::DatumUpdate& datum_update) {
                geodesy_.reset(new goby::util::UTMGeodesy({datum_update.datum().lat_with_units(),
                                                           datum_update.datum().lon_with_units()}));
                moos().comms().Notify("USM_RESET", "x=0, y=0, speed=0, heading=0, depth=0");
            });

        std::vector<std::string> nav_buffer_params(
            {"X", "Y", "DEPTH", "SPEED", "ROLL", "PITCH", "HEADING", "HEADING_OVER_GROUND"});
        for (const auto& var : nav_buffer_params) moos().add_buffer("NAV_" + var);
        moos().add_trigger("NAV_SPEED", [this](const CMOOSMsg& msg) { process_nav(msg); });

        goby().interprocess().subscribe<groups::desired_setpoints>(
            [this](const protobuf::DesiredSetpoints& desired_setpoints) {
                process_desired_setpoints(desired_setpoints);
            });

        interprocess().subscribe<groups::low_control>(
            [this](const jaiabot::protobuf::LowControl& low_control) {
                if (low_control.has_control_surfaces())
                    process_control_surfaces(low_control.control_surfaces());
            });

        for (const auto& sample : sim_cfg_.sample())
        {
            temperature_degC_profile_[sample.depth_with_units()] = sample.temperature();
            salinity_profile_[sample.depth_with_units()] = sample.salinity();
        }

        hdop_rand_max_ = sim_cfg_.gps_hdop_rand_max();
        pdop_rand_max_ = sim_cfg_.gps_pdop_rand_max();
        heading_rand_max_ = sim_cfg_.heading_rand_max();

        // Seed once
        std::srand(unsigned(std::time(NULL)));
    }
    else
    {
        sim_hub_status();
    }
}

void jaiabot::apps::SimulatorTranslation::sim_hub_status()
{
    goby::middleware::protobuf::gpsd::TimePositionVelocity tpv;
    tpv.mutable_location()->set_lat(sim_cfg_.start_location().lat());
    tpv.mutable_location()->set_lon(sim_cfg_.start_location().lon());

    interprocess().publish<goby::middleware::groups::gpsd::tpv>(tpv);
}

void jaiabot::apps::SimulatorTranslation::process_nav(const CMOOSMsg& msg)
{
    auto now = goby::time::SteadyClock::now();
    auto dt = std::chrono::duration_cast<std::chrono::microseconds>(now - last_nav_process_time_)
                  .count() *
              si::micro * si::seconds;

    if (!geodesy_)
        return;

    auto& moos_buffer = moos().buffer();

    auto x = moos_buffer["NAV_X"].GetDouble() * si::meters;
    auto y = moos_buffer["NAV_Y"].GetDouble() * si::meters;
    auto depth = moos_buffer["NAV_DEPTH"].GetDouble() * si::meters;

    // very simple vertical depth simulation assuming perfect controller
    if (last_setpoints_.type() == protobuf::SETPOINT_DIVE)
    {
        x = dive_x_;
        y = dive_y_;

        dive_depth_ += sim_cfg_.vertical_dive_rate_with_units() * quantity<si::time>(dt);
        if (dive_depth_ > last_setpoints_.dive_depth_with_units())
            dive_depth_ = last_setpoints_.dive_depth_with_units();

        // Use an eggshell function for the seafloor depth (for testing contours)
        const auto k = sim_cfg_.seafloor_wavelength_with_units() / 2 * PI;
        const auto seafloor_depth =
            sim_cfg_.seafloor_depth_with_units() +
            sim_cfg_.seafloor_amplitude_with_units() * sin(k * x) * sin(k * y);

        if (dive_depth_ > seafloor_depth)
            dive_depth_ = seafloor_depth;

        depth = dive_depth_;

        std::stringstream reset_ss;
        reset_ss << "x=" << x.value() << ",y=" << y.value() << ",depth=" << depth.value()
                 << ",speed=0,heading=0";
        moos().comms().Notify("USM_RESET", reset_ss.str());
    }
    else
    {
        // keep updating these until we dive
        dive_x_ = x;
        dive_y_ = y;
        dive_depth_ = depth;
    }

    goby::util::gps::RMC rmc;
    goby::util::gps::HDT hdt;

    rmc.status = goby::util::gps::RMC::DataValid;

    auto latlon = geodesy_->convert({x, y});

    rmc.latitude = latlon.lat;
    rmc.longitude = latlon.lon;

    rmc.speed_over_ground =
        quantity<si::velocity>(moos_buffer["NAV_SPEED"].GetDouble() * si::meter_per_second);

    rmc.course_over_ground = moos_buffer["NAV_HEADING_OVER_GROUND"].GetDouble() * degree::degree;

    double heading_error = 0;

    if (heading_rand_max_ != 0)
    {
        heading_error = (double)std::rand() / (RAND_MAX)*heading_rand_max_;
    }

    glog.is_verbose() && glog << "Heading Error: " << heading_error << std::endl;

    hdt.true_heading = (moos_buffer["NAV_HEADING"].GetDouble() + heading_error) * degree::degrees;
    {
        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(rmc.serialize().message_cr_nl());
        interthread().publish<gps_udp_out>(io_data);
    }

    {
        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(hdt.serialize().message_cr_nl());
        interthread().publish<gps_udp_out>(io_data);
    }

    // publish gps sky data
    if (sky_last_updated_ + std::chrono::milliseconds(time_out_sky_) < now)
    {
        goby::middleware::protobuf::gpsd::SkyView sky;

        double hdop;
        double pdop;
        hdop = (double)std::rand() / (RAND_MAX)*hdop_rand_max_;
        pdop = (double)std::rand() / (RAND_MAX)*pdop_rand_max_;

        sky.set_hdop(hdop);
        sky.set_pdop(pdop);
        interprocess().publish<goby::middleware::groups::gpsd::sky>(sky);
        sky_last_updated_ = goby::time::SteadyClock::now();
    }

    // publish pressure as UDP message for bar30 driver
    {
        std::stringstream ss;
        auto pressure = goby::util::seawater::pressure(depth, latlon.lat);

        // interpolate temperature value from table
        double temperature = goby::util::linear_interpolate(depth, temperature_degC_profile_);
        // randomize temperature
        temperature += temperature_distribution_(generator_);

        // omit in sim
        std::string time = "";

        using goby::util::seawater::bar;

        // date_string, p_mbar, t_celsius
        ss << std::setprecision(std::numeric_limits<double>::digits10) << time << ","
           << "bar30"
           << "," << quantity<decltype(si::milli * bar)>(pressure).value() << "," << temperature;
        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(ss.str());
        interthread().publish<pressure_udp_out>(io_data);
    }

    // publish salinity as UDP message for atlas scientific ezo-ec driver
    {
        std::stringstream ss;
        // interpolate salinity value from table
        double salinity = goby::util::linear_interpolate(depth, salinity_profile_);
        // randomize salinity
        salinity += salinity_distribution_(generator_);

        // omit in sim
        std::string time = "";
        std::string conductivity = "0.0";
        std::string dissolved_solids = "0.0";
        std::string specific_gravity = "0.0";

        // date_string, conductivity, dissolved solids, salinity, specific gravity
        ss << std::setprecision(std::numeric_limits<double>::digits10) << time << ","
           << conductivity << "," << dissolved_solids << "," << salinity << "," << specific_gravity;

        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(ss.str());
        interthread().publish<salinity_udp_out>(io_data);
    }

    // publish IMUData
    {
        jaiabot::protobuf::IMUData imu_data;
        imu_data.mutable_euler_angles()->set_pitch_with_units(moos_buffer["NAV_PITCH"].GetDouble() *
                                                              si::radians);
        imu_data.mutable_euler_angles()->set_roll_with_units(moos_buffer["NAV_ROLL"].GetDouble() *
                                                              si::radians);
        imu_data.set_calibration_status(3);
        imu_data.set_significant_wave_height(1.5);
        imu_data.set_max_acceleration(101);
        interprocess().publish<groups::imu>(imu_data);
    }

    last_nav_process_time_ = now;
}

void jaiabot::apps::SimulatorTranslation::process_desired_setpoints(
    const protobuf::DesiredSetpoints& desired_setpoints)
{
    last_setpoints_ = desired_setpoints;

    switch (desired_setpoints.type())
    {
        // all of these can be handled by uSimMarine directly
        case protobuf::SETPOINT_IVP_HELM:
        case protobuf::SETPOINT_STOP:
        case protobuf::SETPOINT_POWERED_ASCENT:
        case protobuf::SETPOINT_REMOTE_CONTROL:
            moos().comms().Notify("MOOS_MANUAL_OVERRIDE", "false");
            break;

            // handled by depth loop by resetting uSimMarine
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

    moos().comms().Notify("DESIRED_THRUST", thrust_normalization * control_surfaces.motor());
    moos().comms().Notify("DESIRED_RUDDER", rudder_normalization * control_surfaces.rudder());
    moos().comms().Notify(
        "DESIRED_ELEVATOR",
        elevator_normalization *
            (control_surfaces.port_elevator() + control_surfaces.stbd_elevator()) / 2);
}

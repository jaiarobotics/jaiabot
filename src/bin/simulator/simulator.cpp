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
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/low_control.pb.h"
#include "jaiabot/messages/simulator.pb.h"
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
    quantity<si::length> egg_box_function(const quantity<si::length> mean_value,
                                          const quantity<si::length> amplitude,
                                          const quantity<si::length> wavelength,
                                          const quantity<si::length> x,
                                          const quantity<si::length> y);

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

    goby::time::SteadyClock::time_point gps_dropout_end_{std::chrono::seconds(0)};
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
            [this](const jaiabot::protobuf::Engineering& engineering) {
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
                    case jaiabot::protobuf::SimulatorCommand::kGpsDropout:
                        gps_dropout_end_ =
                            goby::time::SteadyClock::now() +
                            goby::time::convert_duration<goby::time::SteadyClock::duration>(
                                command.gps_dropout().dropout_duration_with_units());

                        break;

                    case jaiabot::protobuf::SimulatorCommand::kStopForwardProgress:
                        stop_forward_progress_end_ =
                            goby::time::SteadyClock::now() +
                            goby::time::convert_duration<goby::time::SteadyClock::duration>(
                                command.stop_forward_progress().duration_with_units());
                        break;

                }
            });

        for (const auto& sample : sim_cfg_.sample())
        {
            temperature_degC_profile_[sample.depth_with_units()] = sample.temperature();
            salinity_profile_[sample.depth_with_units()] = sample.salinity();
        }

        // Seed once
        std::srand(unsigned(std::time(NULL)));
    }
    else
    {
        sim_hub_status();

        // Subscribe to engineering commands for:
        // * hub_location
        interprocess().subscribe<jaiabot::groups::hub_command_full>(
            [this](const jaiabot::protobuf::CommandForHub& hub_command) {
                glog.is_warn() && glog << "Received hub_command: " << hub_command.ShortDebugString()
                                       << std::endl;

                if (hub_command.has_hub_location())
                {
                    auto location = hub_command.hub_location();

                    // Re-publish hub at new coordinates
                    goby::middleware::protobuf::gpsd::TimePositionVelocity tpv;
                    tpv.mutable_location()->set_lat_with_units(location.lat_with_units());
                    tpv.mutable_location()->set_lon_with_units(location.lon_with_units());
                    interprocess().publish<goby::middleware::groups::gpsd::tpv>(tpv);

                    // Publish a datum change
                    goby::middleware::protobuf::DatumUpdate update;
                    update.mutable_datum()->set_lat_with_units(location.lat_with_units());
                    update.mutable_datum()->set_lon_with_units(location.lon_with_units());
                    this->interprocess().template publish<goby::middleware::groups::datum_update>(
                        update);
                }
            });
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

        const auto seafloor_depth = egg_box_function(
            sim_cfg_.seafloor_depth_with_units(), sim_cfg_.seafloor_amplitude_with_units(),
            sim_cfg_.seafloor_wavelength_with_units(), x, y);

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

    if (sim_cfg_.heading_rand_max() > 0)
    {
        heading_error = static_cast<double>(std::rand()) / (RAND_MAX)*sim_cfg_.heading_rand_max();
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

        bool is_dropout = goby::time::SteadyClock::now() <= gps_dropout_end_;

        double hdop =
            is_dropout ? sim_cfg_.gps_hdop_dropout()
                       : static_cast<double>(std::rand()) / (RAND_MAX)*sim_cfg_.gps_hdop_rand_max();
        double pdop =
            is_dropout ? sim_cfg_.gps_pdop_dropout()
                       : static_cast<double>(std::rand()) / (RAND_MAX)*sim_cfg_.gps_pdop_rand_max();

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
        auto pitch = moos_buffer["NAV_PITCH"].GetDouble() * si::radians;
        if (!making_forward_progress_)
            pitch = sim_cfg_.pitch_at_rest_with_units<decltype(pitch)>();

        imu_data.mutable_euler_angles()->set_pitch_with_units(pitch);
        imu_data.mutable_euler_angles()->set_roll_with_units(moos_buffer["NAV_ROLL"].GetDouble() *
                                                             si::radians);
        imu_data.set_calibration_status(3);
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

/**
 * Generates a seafloor depth value for a given coordinate based on an egg box function.
 *
 * An egg box function is a periodic function z(x, y), which is a periodic and sine-function along both
 * axes. See https://mathcurve.com/surfaces.gb/boiteaoeufs/boiteaoeufs.shtml. It's a useful function for 
 * testing the generated contour maps of the ocean floor, in simulation.
 *
 * @param mean_value Mean value of the returned function
 * @param amplitude Maximum amplitude of the generated wave crests
 * @param wavelength Wavelength of the generated waves
 * @param x x coordinate of the location to sample the function
 * @param y y coordinate of the location to sample the function
 * @return Value of the specified egg box function at the point (x, y)
 */
quantity<si::length> jaiabot::apps::SimulatorTranslation::egg_box_function(
    const quantity<si::length> mean_value, const quantity<si::length> amplitude,
    const quantity<si::length> wavelength, const quantity<si::length> x,
    const quantity<si::length> y)
{
    const auto k = 2 * PI / wavelength;
    return mean_value + amplitude * sin(k * x) * sin(k * y);
}

// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matt Ferro <matt.ferro@jaia.tech>
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

#ifndef JAIABOT_SRC_BIN_SIMULATOR_SIMULATOR_THREAD_H
#define JAIABOT_SRC_BIN_SIMULATOR_SIMULATOR_THREAD_H

#include <boost/units/systems/si.hpp>
#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot/messages/health.pb.h"
#include <goby/time/steady_clock.h>

#include "config.pb.h"

#include "jaiabot/units/conductivity.h"

namespace jaiabot
{
namespace apps
{

constexpr goby::middleware::Group gateway_udp_in{"gateway_udp_in"};
constexpr goby::middleware::Group gateway_udp_out{"gateway_udp_out"};

constexpr goby::middleware::Group gps_udp_in{"gps_udp_in"};
constexpr goby::middleware::Group gps_udp_out{"gps_udp_out"};

constexpr goby::middleware::Group to_moos{"to_moos"};

// written by main moos translator thread
constexpr goby::middleware::Group moos_nav{"moos_nav"};

// written by STORM simulator
constexpr goby::middleware::Group storm_nav{"storm_nav"};

// written by dive simulator
constexpr goby::middleware::Group dive_nav{"dive_nav"};

// Most downstream threads use this nav
constexpr goby::middleware::Group sim_nav{"sim_nav"};

constexpr goby::middleware::Group sim_oceanography{"sim_oceanography"};

struct SimNav
{
    boost::units::quantity<boost::units::si::length> x;
    boost::units::quantity<boost::units::si::length> y;
    boost::units::quantity<boost::units::si::velocity> speed_over_ground;
    boost::units::quantity<boost::units::degree::plane_angle> course_over_ground;
    boost::units::quantity<boost::units::si::length> depth;
    boost::units::quantity<boost::units::degree::plane_angle> heading;
    boost::units::quantity<boost::units::si::plane_angle> pitch;
    boost::units::quantity<boost::units::si::plane_angle> roll;

    // added by main thread before publishing "sim_nav"
    goby::util::UTMGeodesy::LatLonPoint latlon;
};

struct SimOceanography
{
    SimNav nav;
    boost::units::quantity<boost::units::si::pressure> pressure;
    boost::units::quantity<boost::units::absolute<boost::units::celsius::temperature>> temperature;
    double salinity;
    boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> conductivity;
};

template <typename Config> class SimulatorThread : public goby::middleware::SimpleThread<Config>
{
  public:
    SimulatorThread(const Config& cfg, std::string thread_name,
                    boost::units::quantity<boost::units::si::frequency> report_freq)
        : goby::middleware::SimpleThread<Config>(cfg, report_freq), thread_name_(thread_name)
    {
    }
    virtual ~SimulatorThread() {}

    const std::string& thread_name() { return thread_name_; }

  protected:
  private:
    void loop() override {}

  private:
    std::string thread_name_;
};

} // namespace apps
} // namespace jaiabot

#endif

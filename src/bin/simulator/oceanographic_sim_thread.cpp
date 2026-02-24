// Copyright 2026:
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

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/protobuf/io.pb.h>
#include <goby/util/linebasedcomms/gps_sentence.h>
#include <goby/util/sci.h>
#include <goby/util/seawater.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/simulator.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"

#include "oceanographic_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::OceanographicSimThread::OceanographicSimThread(
    const jaiabot::config::OceanographicSimThread& cfg)
    : SimulatorThread<jaiabot::config::OceanographicSimThread>(cfg, "oceanographic_simulator",
                                                               0 * boost::units::si::hertz),
      temperature_distribution_(0, cfg.temperature_stdev()),
      salinity_distribution_(0, cfg.salinity_stdev())
{
    glog.add_group("oceanographic", goby::util::Colors::magenta);

    interthread().subscribe<sim_nav>([this](const SimNav& nav) { handle_sim_nav(nav); });

    for (const auto& sample : cfg.sample())
    {
        temperature_degC_profile_[sample.depth_with_units()] = sample.temperature();
        salinity_profile_[sample.depth_with_units()] = sample.salinity();
    }
}

void jaiabot::apps::OceanographicSimThread::handle_sim_nav(const SimNav& nav)
{
    boost::units::quantity<boost::units::si::pressure> pressure(
        goby::util::seawater::pressure(nav.depth, nav.latlon.lat));
    
    // interpolate temperature value from table
    double temperature_degC = goby::util::linear_interpolate(nav.depth, temperature_degC_profile_);
    // randomize temperature
    temperature_degC += temperature_distribution_(generator_);

    auto temperature =
        temperature_degC * boost::units::absolute<boost::units::celsius::temperature>();

    // interpolate salinity value from table
    double salinity = goby::util::linear_interpolate(nav.depth, salinity_profile_);
    // randomize salinity
    salinity += salinity_distribution_(generator_);

    auto ocean_data = std::make_shared<SimOceanography>();
    ocean_data->nav = nav;
    ocean_data->pressure = pressure;
    ocean_data->temperature = temperature;
    ocean_data->salinity = salinity;

    glog.is_debug1() && glog << group("oceanographic")
                             << "Ocean data (pressure, salinity, temperature): (" << pressure
                             << ", " << salinity << ", " << temperature << ")" << std::endl;

    interthread().publish<sim_oceanography>(ocean_data);
}

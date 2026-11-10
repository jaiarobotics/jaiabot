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
#include "jaiabot/units/conductivity.h"

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
    glog.is_debug1() && glog << group("oceanographic") << "Input nav (depth, lat): (" << nav.depth
                             << ", " << nav.latlon.lat << ")" << std::endl;

    // relative to sea surface pressure (0 Pa at surface)
    boost::units::quantity<boost::units::si::pressure> pressure;
    boost::units::quantity<boost::units::absolute<boost::units::celsius::temperature>> temperature;
    double salinity{0};
    boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> conductivity;

    if (nav.depth >= 0 * si::meters) // in water
    {
        pressure = boost::units::quantity<boost::units::si::pressure>(
            goby::util::seawater::pressure(nav.depth, nav.latlon.lat));
        // interpolate temperature value from table
        double temperature_degC =
            goby::util::linear_interpolate(nav.depth, temperature_degC_profile_);
        // randomize temperature
        temperature_degC += temperature_distribution_(generator_);

        temperature =
            temperature_degC * boost::units::absolute<boost::units::celsius::temperature>();

        // interpolate salinity value from table
        salinity = goby::util::linear_interpolate(nav.depth, salinity_profile_);
        // randomize salinity
        salinity += salinity_distribution_(generator_);

        conductivity = decltype(conductivity)(
            goby::util::seawater::conductivity(salinity, temperature, pressure));
    }
    else // in air
    {
        // from https://apps.dtic.mil/sti/tr/pdf/ADA588839.pdf
        //<=======================================PRESSURE (Pa)
        const double TABLE4[8][4] = {
            //<===============================TRANSITION POINTS
            00000, -0.0065, 288.150, 1.01325000000000E+5, // FOR PRESSURE &
            11000, 0.0000,  216.650, 2.26320639734629E+4, // TEMPERATURE VS
            20000, 0.0010,  216.650, 5.47488866967777E+3, // GEOPOTENTIAL
            32000, 0.0028,  228.650, 8.68018684755228E+2, // ALTITUDE CURVES
            47000, 0.0000,  270.650, 1.10906305554966E+2, // [table 4]
            51000, -0.0028, 270.650, 6.69388731186873E+1, // (3RD COLUMN IS
            71000, -0.0020, 214.650, 3.95642042804073E+0, // TEMPERATURE,
            84852, 0.0000,  186.946, 3.73383589976215E-1  // 4TH, PRESSURE)
        };

        // z <--------ALTITUDE (m) (P IS VALID FOR -5,000 m < z < 86,000 m)
        auto pressure_f = [TABLE4](double z) -> double
        {
            double H = z * 6356766 / (z + 6356766); //..............................[equation 18]
            int b;                                  /*<-*/
            for (b = 0; b < 7; ++b)
                if (H < TABLE4[b + 1][0])
                    break;
            double C = -.0341631947363104; //................C = -G0*M0/RSTAR [pages 8,9,3]
            double Hb = TABLE4[b][0], Lb = TABLE4[b][1], Tb = TABLE4[b][2], Pb = TABLE4[b][3];
            return Pb * (fabs(Lb) > 1E-12 ? pow(1 + Lb / Tb * (H - Hb), C / Lb)
                                          : exp(C * (H - Hb) / Tb));
        };

        double z = -nav.depth / si::meters;
        pressure = (pressure_f(z) - pressure_f(0)) * si::pascals;

        // https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html
        temperature =
            (15.04 - .00649 * z) * boost::units::absolute<boost::units::celsius::temperature>();
        conductivity = 0 * jaiabot::units::microsiemens_per_cm;
        salinity = -1;
    }

    auto ocean_data = std::make_shared<SimOceanography>();
    ocean_data->nav = nav;
    ocean_data->pressure = pressure;
    ocean_data->temperature = temperature;
    ocean_data->conductivity = conductivity;
    ocean_data->salinity = salinity;

    glog.is_debug1() && glog << group("oceanographic")
                             << "Ocean data (pressure, conductivity, salinity, temperature): ("
                             << pressure << ", " << conductivity << ", " << salinity << ", "
                             << temperature << ")" << std::endl;

    interthread().publish<sim_oceanography>(ocean_data);
}

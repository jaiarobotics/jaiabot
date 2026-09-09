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

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/protobuf/io.pb.h>
#include <goby/util/linebasedcomms/gps_sentence.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/simulator.pb.h"

#include "gps_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::GPSSimThread::GPSSimThread(const jaiabot::config::GPSSimThread& cfg)
    : SimulatorThread<jaiabot::config::GPSSimThread>(cfg, "gps_simulator",
                                                     0 * boost::units::si::hertz)
{
    glog.add_group("gps", goby::util::Colors::magenta);

    interthread().subscribe<sim_nav>([this](const SimNav& nav) { handle_sim_nav(nav); });

    interprocess().subscribe<jaiabot::groups::simulator_command>(
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

                default:
                    // handled in another thread
                    break;
            }
        });
}

void jaiabot::apps::GPSSimThread::handle_sim_nav(const SimNav& nav)
{
    auto now = goby::time::SteadyClock::now();

    goby::util::gps::RMC rmc;
    goby::util::gps::HDT hdt;

    rmc.status = goby::util::gps::RMC::DataValid;

    rmc.latitude = nav.latlon.lat;
    rmc.longitude = nav.latlon.lon;

    rmc.speed_over_ground = nav.speed_over_ground;
    rmc.course_over_ground = nav.course_over_ground;

    double heading_error = 0;

    if (cfg().heading_rand_max() > 0)
    {
        heading_error = static_cast<double>(std::rand()) / (RAND_MAX)*cfg().heading_rand_max();
    }

    glog.is_debug2() && glog << group("gps") << "Heading Error: " << heading_error << std::endl;

    hdt.true_heading = nav.heading + (heading_error * degree::degrees);
    {
        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(rmc.serialize().message_cr_nl());
        glog.is_debug1() && glog << group("gps") << "rmc -> gpsd: " << rmc.serialize().message()
                                 << std::endl;
        interthread().publish<gps_udp_out>(io_data);
    }

    {
        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->set_data(hdt.serialize().message_cr_nl());
        glog.is_debug1() && glog << group("gps") << "hdt -> gpsd: " << hdt.serialize().message()
                                 << std::endl;
        interthread().publish<gps_udp_out>(io_data);
    }

    // publish gps sky data
    if (sky_last_updated_ + std::chrono::milliseconds(time_out_sky_) < now)
    {
        goby::middleware::protobuf::gpsd::SkyView sky;

        bool is_dropout = goby::time::SteadyClock::now() <= gps_dropout_end_;

        double hdop = is_dropout
                          ? cfg().hdop_dropout()
                          : static_cast<double>(std::rand()) / (RAND_MAX)*cfg().hdop_rand_max();
        double pdop = is_dropout
                          ? cfg().pdop_dropout()
                          : static_cast<double>(std::rand()) / (RAND_MAX)*cfg().pdop_rand_max();

        sky.set_hdop(hdop);
        sky.set_pdop(pdop);
        glog.is_debug1() && glog << group("gps") << "sky (as goby_gps): " << sky.ShortDebugString()
                                 << std::endl;

        interprocess().publish<goby::middleware::groups::gpsd::sky>(sky);
        sky_last_updated_ = goby::time::SteadyClock::now();
    }
}

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

#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/simulator.pb.h"

#include "hub_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::HubSimThread::HubSimThread(const jaiabot::config::Simulator& cfg)
    : SimulatorThread<jaiabot::config::Simulator>(cfg, "hub_simulator",
                                                  0.1 * boost::units::si::hertz),
      hub_location_(cfg.start_location())
{
    glog.add_group("hub", goby::util::Colors::magenta);

    interprocess().subscribe<jaiabot::groups::hub_command_full>(
        [this](const jaiabot::protobuf::CommandForHub& hub_command)
        {
            glog.is_verbose() && glog << group("hub")
                                      << "Received hub_command: " << hub_command.ShortDebugString()
                                      << std::endl;

            if (hub_command.has_hub_location())
            {
                hub_location_ = hub_command.hub_location();
                sim_hub_status(hub_location_);

                // Publish a datum change
                goby::middleware::protobuf::DatumUpdate update;
                update.mutable_datum()->set_lat_with_units(hub_location_.lat_with_units());
                update.mutable_datum()->set_lon_with_units(hub_location_.lon_with_units());
                this->interprocess().template publish<goby::middleware::groups::datum_update>(
                    update);
            }
        });
}

void jaiabot::apps::HubSimThread::loop() { sim_hub_status(hub_location_); }

void jaiabot::apps::HubSimThread::sim_hub_status(
    const jaiabot::protobuf::GeographicCoordinate& location)
{
    goby::middleware::protobuf::gpsd::TimePositionVelocity tpv;
    tpv.mutable_location()->set_lat(location.lat());
    tpv.mutable_location()->set_lon(location.lon());
    tpv.set_device(cfg().hub_config().gpsd_device());

    glog.is_debug1() && glog << group("hub") << "tpv (as goby_gps): " << tpv.ShortDebugString()
                             << std::endl;
    interprocess().publish<goby::middleware::groups::gpsd::tpv>(tpv);
}

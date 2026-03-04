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

#include <goby/middleware/protobuf/io.pb.h>
#include <goby/util/sci.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/simulator.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"

#include "ezo_ec_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::EzoECSimThread::EzoECSimThread(const jaiabot::config::EzoECSimThread& cfg)
    : SimulatorThread<jaiabot::config::EzoECSimThread>(cfg, "ezo_ec_simulator",
                                                       0 * boost::units::si::hertz)
{
    glog.add_group("ezo_ec", goby::util::Colors::magenta);

    interthread().subscribe<sim_oceanography>([this](const SimOceanography& ocean_data)
                                              { handle_sim_oceanography(ocean_data); });
}

void jaiabot::apps::EzoECSimThread::handle_sim_oceanography(const SimOceanography& ocean_data)
{
    // publish salinity as UDP message for atlas scientific ezo-ec driver
    std::stringstream ss;

    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    auto salinity_data = envelope.mutable_salinity_data();
    // We only set the raw values here, because the derived values are calculated elsewhere, after the data comes in from the sensor.
    salinity_data->set_conductivity_raw(ocean_data.conductivity.value());
    salinity_data->set_salinity_raw(ocean_data.salinity);
    salinity_data->set_total_dissolved_solids(0.0);

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data(envelope.SerializeAsString());

    glog.is_debug1() && glog << group("ezo_ec") << "-> udp_gateway: " << envelope.ShortDebugString()
                             << std::endl;

    interthread().publish<gateway_udp_out>(io_data);
}

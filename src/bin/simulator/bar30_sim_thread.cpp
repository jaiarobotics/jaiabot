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
#include <goby/util/seawater.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/simulator.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"

#include "bar30_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::Bar30SimThread::Bar30SimThread(const jaiabot::config::Bar30SimThread& cfg)
    : SimulatorThread<jaiabot::config::Bar30SimThread>(cfg, "bar30_simulator",
                                                       0 * boost::units::si::hertz)
{
    glog.add_group("bar30", goby::util::Colors::magenta);

    interthread().subscribe<sim_oceanography>([this](const SimOceanography& ocean_data)
                                              { handle_sim_oceanography(ocean_data); });
}

void jaiabot::apps::Bar30SimThread::handle_sim_oceanography(const SimOceanography& ocean_data)
{
    using goby::util::seawater::bar;

    // convert pressure from decibars to millibars to mimic output of BARXX sensor
    auto envelope = jaiabot::protobuf::UDPGatewayEnvelope();
    auto pressure_temperature_data = envelope.mutable_pressure_temperature_data();
    pressure_temperature_data->set_pressure_raw(
        boost::units::quantity<decltype(si::milli * bar)>(ocean_data.pressure).value());
    pressure_temperature_data->set_temperature_with_units(ocean_data.temperature);

    pressure_temperature_data->set_sensor_type(jaiabot::protobuf::PressureSensorType::BAR30);

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data(envelope.SerializeAsString());

    glog.is_debug1() && glog << group("bar30") << "-> udp_gateway: " << envelope.ShortDebugString()
                             << std::endl;

    interthread().publish<gateway_udp_out>(io_data);
}

// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Edited by Ed Sanville <edsanville@gmail.com>
//
//
// This file is part of the JaiaBot Hydro Project Binaries
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

#include <numeric>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>
#include <iostream>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/wave.pb.h"

using goby::glog;
using namespace std;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group gps_wave_height_udp_in{"gps_wave_height_udp_in"};
constexpr goby::middleware::Group gps_wave_height_udp_out{"gps_wave_height_udp_out"};

class GPSWaveHeightDriver : public zeromq::MultiThreadApplication<config::GPSWaveHeightDriver>
{
  public:
    GPSWaveHeightDriver();

  private:
    void loop() override;

  private:
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::GPSWaveHeightDriver>(
        goby::middleware::ProtobufConfigurator<config::GPSWaveHeightDriver>(argc, argv));
}

// Main thread

double loop_freq = 1;

jaiabot::apps::GPSWaveHeightDriver::GPSWaveHeightDriver()
    : zeromq::MultiThreadApplication<config::GPSWaveHeightDriver>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<gps_wave_height_udp_in,
                                                                     gps_wave_height_udp_out>;
    launch_thread<GPSUDPThread>(cfg().udp_config());

    interthread().subscribe<gps_wave_height_udp_in>(
        [this](const goby::middleware::protobuf::IOData& data) {
            // Deserialize from the UDP packet
            jaiabot::protobuf::WaveData wave_data;
            if (!wave_data.ParseFromString(data.data()))
            {
                glog.is_warn() && glog << "Couldn't deserialize WaveData from the UDP packet"
                                       << endl;
                return;
            }

            glog.is_debug2() && glog << "Publishing WaveData: " << wave_data.ShortDebugString()
                                     << endl;

            interprocess().publish<groups::gps_wave>(wave_data);
        });
}

void jaiabot::apps::GPSWaveHeightDriver::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    auto command = jaiabot::protobuf::WaveCommand();
    command.set_type(jaiabot::protobuf::WaveCommand::TAKE_READING);

    io_data->set_data(command.SerializeAsString());
    interthread().publish<gps_wave_height_udp_out>(io_data);

    glog.is_debug2() && glog << "Requesting WaveData from python driver" << endl;
}

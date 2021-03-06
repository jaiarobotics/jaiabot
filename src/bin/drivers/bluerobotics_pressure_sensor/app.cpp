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
#include <boost/units/absolute.hpp>
#include <boost/units/io.hpp>
#include <boost/units/systems/temperature/celsius.hpp>
#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/util/seawater/units.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/pressure_temperature.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group bar30_udp_in{"bar30_udp_in"};
constexpr goby::middleware::Group bar30_udp_out{"bar30_udp_out"};

class BlueRoboticsPressureSensorDriver : public zeromq::MultiThreadApplication<config::BlueRoboticsPressureSensorDriver>
{
  public:
    BlueRoboticsPressureSensorDriver();

  private:
    void loop() override;

  private:
    dccl::Codec dccl_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::BlueRoboticsPressureSensorDriver>(
        goby::middleware::ProtobufConfigurator<config::BlueRoboticsPressureSensorDriver>(argc, argv));
}

// Main thread

// for string delimiter
std::vector<std::string> split(std::string s, std::string delimiter)
{
    size_t pos_start = 0, pos_end, delim_len = delimiter.length();
    std::string token;
    std::vector<std::string> res;

    while ((pos_end = s.find(delimiter, pos_start)) != std::string::npos)
    {
        token = s.substr(pos_start, pos_end - pos_start);
        pos_start = pos_end + delim_len;
        res.push_back(token);
    }

    res.push_back(s.substr(pos_start));
    return res;
}

jaiabot::apps::BlueRoboticsPressureSensorDriver::BlueRoboticsPressureSensorDriver()
    : zeromq::MultiThreadApplication<config::BlueRoboticsPressureSensorDriver>(2 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("bar30_test", goby::util::Colors::lt_magenta);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<bar30_udp_in, bar30_udp_out>;
    launch_thread<GPSUDPThread>(cfg().udp_config());

    interprocess().subscribe<bar30_udp_in>(
        [this](const goby::middleware::protobuf::IOData& bar30_data) {
            auto s = std::string(bar30_data.data());
            auto fields = split(s, ",");

            using goby::util::seawater::bar;
            namespace celsius = boost::units::celsius;
            using boost::units::absolute;

            auto date_string = fields[0];
            auto p_mbar = std::stod(fields[1]) * si::milli * bar;
            auto t_celsius = std::stod(fields[2]) * absolute<celsius::temperature>();

            glog.is_verbose() && glog << group("bar30_test") << "p_mbar: " << p_mbar
                                      << ", t_celsius: " << t_celsius << std::endl;

            protobuf::PressureTemperatureData data;

            data.set_pressure_with_units(p_mbar);
            data.set_temperature_with_units(t_celsius);

            interprocess().publish<groups::pressure_temperature>(data);
        });
}

void jaiabot::apps::BlueRoboticsPressureSensorDriver::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<bar30_udp_out>(io_data);
}

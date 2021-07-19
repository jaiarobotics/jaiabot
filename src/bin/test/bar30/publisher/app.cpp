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
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/feather.pb.h"
#include "jaiabot/messages/bar30.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group bar30{"bar30"};

namespace jaiabot
{
namespace apps
{
class Bar30Publisher : public zeromq::MultiThreadApplication<config::Bar30Publisher>
{
  public:
    Bar30Publisher();

  private:
    void loop() override;

  private:
    dccl::Codec dccl_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Bar30Publisher>(
        goby::middleware::ProtobufConfigurator<config::Bar30Publisher>(argc, argv));
}

// Main thread

double loop_freq = 1;

jaiabot::apps::Bar30Publisher::Bar30Publisher()
    : zeromq::MultiThreadApplication<config::Bar30Publisher>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("bar30_test", goby::util::Colors::lt_magenta);
}

void jaiabot::apps::Bar30Publisher::loop()
{
    auto f = std::ifstream(cfg().input_file_path());
    std::string date_string;
    std::string p_mbar_string, t_celsius_string;
    std::getline(f, date_string, ',');
    std::getline(f, p_mbar_string, ',');
    std::getline(f, t_celsius_string);
    double p_mbar = std::stod(p_mbar_string);
    double t_celsius = std::stod(t_celsius_string);

    protobuf::Bar30Data data;
    data.set_p_mbar(p_mbar);
    data.set_t_celsius(t_celsius);

    glog.is_verbose() && glog << group("bar30_test") << "Date: " << date_string << ", p_mbar: " << p_mbar << ", t_calsius: " << t_celsius << std::endl;

    interprocess().publish<groups::bar30>(data);
}

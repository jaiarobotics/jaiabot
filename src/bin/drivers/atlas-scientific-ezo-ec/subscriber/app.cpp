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
#include "jaiabot/messages/salinity.pb.h"

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
class SalinitySubscriber : public zeromq::MultiThreadApplication<config::SalinitySubscriber>
{
  public:
    SalinitySubscriber();

  private:
    void loop() override;

  private:
    dccl::Codec dccl_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::SalinitySubscriber>(
        goby::middleware::ProtobufConfigurator<config::SalinitySubscriber>(argc, argv));
}

// Main thread

double loop_freq = 0;

jaiabot::apps::SalinitySubscriber::SalinitySubscriber()
    : zeromq::MultiThreadApplication<config::SalinitySubscriber>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    interprocess().subscribe<jaiabot::groups::salinity>([this](const protobuf::SalinityData& data) {
      glog.is_verbose() && glog << group("main") << "Electrical conductivity:  " << data.conductivity() << " microS / cm" << std::endl;
      glog.is_verbose() && glog << group("main") << "Total dissolved solids:   " << data.total_dissolved_solids() << " ppm" << std::endl;
      glog.is_verbose() && glog << group("main") << "Salinity (PSU):           " << data.salinity() << " g / kg" << std::endl;
      glog.is_verbose() && glog << group("main") << "Specific gravity:         " << data.specific_gravity() << " g / cm^3" << std::endl;
    });
}

void jaiabot::apps::SalinitySubscriber::loop()
{
}

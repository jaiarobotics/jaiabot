// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

#include <cstdlib>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/version.h>
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
using namespace jaiabot::protobuf;

#include "jaiabot/groups.h"
#include "jaiabot/metadata.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::Metadata>;
using namespace std;

namespace jaiabot
{
namespace apps
{
class Metadata : public ApplicationBase
{
  public:
    Metadata() : ApplicationBase(1.0 / 600.0 * si::hertz)
    {
        // Subscribe to MetaData
        interprocess().subscribe<jaiabot::groups::metadata>(
            [this](const jaiabot::protobuf::QueryDeviceMetaData& query_metadata)
            { publish_metadata(); });
    }

  private:
    void loop() override;
    void publish_metadata();
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Metadata>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Metadata>(argc, argv));
}

void jaiabot::apps::Metadata::publish_metadata()
{
    DeviceMetadata metadata = jaiabot::metadata();

    if (cfg().has_xbee())
    {
        metadata.set_xbee_node_id(cfg().xbee().node_id());
        metadata.set_xbee_serial_number(cfg().xbee().serial_number());
    }

    glog.is_verbose() && glog << "DeviceMetadata: " << metadata.ShortDebugString() << std::endl;

    interprocess().publish<groups::metadata>(metadata);
}

void jaiabot::apps::Metadata::loop() { publish_metadata(); }

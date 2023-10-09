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
#include "jaiabot/messages/metadata.pb.h"
using namespace jaiabot::protobuf;

#include "jaiabot/groups.h"
#include "jaiabot/version.h"

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
    // called at frequency passed to SingleThreadApplication (ApplicationBase)
    auto jaia_name_c = getenv("JAIA_DEVICE_NAME");
    string jaia_device_name;
    if (jaia_name_c)
    {
        jaia_device_name = string(jaia_name_c);
    }
    else
    {
        char buffer[256];
        if (gethostname(buffer, 256) == 0)
        {
            jaia_device_name = string(buffer);
        }
        else
        {
            jaia_device_name = "<No Name>";
        }
    }

    DeviceMetadata metadata;
    metadata.set_name(jaia_device_name);
    auto& jaiabot_version = *metadata.mutable_jaiabot_version();
    jaiabot_version.set_major(JAIABOT_VERSION_MAJOR);
    jaiabot_version.set_minor(JAIABOT_VERSION_MINOR);
    jaiabot_version.set_patch(JAIABOT_VERSION_PATCH);

#ifdef JAIABOT_VERSION_GITHASH
    jaiabot_version.set_git_hash(JAIABOT_VERSION_GITHASH);
    jaiabot_version.set_git_branch(JAIABOT_VERSION_GITBRANCH);
#endif

    metadata.set_goby_version(goby::VERSION_STRING);
    metadata.set_moos_version(MOOS_VERSION);

    if (cfg().has_xbee())
    {
        metadata.set_xbee_node_id(cfg().xbee().node_id());
        metadata.set_xbee_serial_number(cfg().xbee().serial_number());
    }
    metadata.set_intervehicle_api_version(jaiabot::INTERVEHICLE_API_VERSION);

    glog.is_verbose() && glog << "DeviceMetadata: " << metadata.ShortDebugString() << std::endl;

    interprocess().publish<groups::metadata>(metadata);
}

void jaiabot::apps::Metadata::loop() { publish_metadata(); }

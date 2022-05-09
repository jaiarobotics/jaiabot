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
using namespace std;

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/messages/metadata.pb.h"
using namespace jaiabot::protobuf;

#include "jaiabot/groups.h"
using namespace jaiabot::groups;

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::Metadata>;

namespace jaiabot
{
namespace apps
{
class Metadata : public ApplicationBase
{
  public:
    Metadata() : ApplicationBase(0.0 * si::hertz)
    {
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

        glog.is_verbose() && glog << "jaia_device_name = " << jaia_device_name << endl;

        auto metadata = DeviceMetadata();
        metadata.set_name(jaia_device_name);

        interprocess().publish<jaia_metadata>(metadata);
    }

  private:
    void loop() override;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Metadata>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Metadata>(argc, argv));
}

void jaiabot::apps::Metadata::loop()
{
    // called at frequency passed to SingleThreadApplication (ApplicationBase)
}

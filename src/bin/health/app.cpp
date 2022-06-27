// Copyright 2021:
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

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::Health>;

namespace jaiabot
{
namespace apps
{
class Health : public ApplicationBase
{
  public:
    Health();
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Health>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Health>(argc, argv));
}

jaiabot::apps::Health::Health()
{
    // handle restart/reboot commands since we run this app as root
    interprocess().subscribe<jaiabot::groups::hub_command>([this](
                                                               const protobuf::Command& command) {
        switch (command.type())
        {
            // most commands handled by jaiabot_mission_manager
            default: break;

            case protobuf::Command::REBOOT_COMPUTER:
                glog.is_verbose() && glog << "Commanded to reboot computer. " << std::endl;
                system("systemctl reboot");
                break;
            case protobuf::Command::RESTART_ALL_SERVICES:
                glog.is_verbose() && glog << "Commanded to restart jaiabot services. " << std::endl;
                system("systemctl restart jaiabot");
                break;
        }
    });
}

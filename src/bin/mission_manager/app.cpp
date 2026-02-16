// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

// Goby
#include <goby/middleware/application/multi_thread.h>
#include <goby/middleware/application/configurator.h>
#include <goby/middleware/group.h>

// Jaiabot
#include "jaiabot/intervehicle.h"

// Mission Manager app
#include "groups.h"
#include "mission_manager.h"


namespace jaiabot
{
namespace apps
{

namespace groups
{

std::unique_ptr<goby::middleware::DynamicGroup> hub_command_this_bot;

} // namespace groups

class MissionManagerConfigurator
    : public goby::middleware::ProtobufConfigurator<config::MissionManager>
{
  public:
    MissionManagerConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<config::MissionManager>(argc, argv)
    {
        auto& cfg = mutable_cfg();

        // create a specific dynamic group for this bot's ID so we only subscribe to our own commands
        groups::hub_command_this_bot.reset(new goby::middleware::DynamicGroup(
            jaiabot::intervehicle::hub_command_group(cfg.bot_id())));
    }
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::MissionManager>(
        jaiabot::apps::MissionManagerConfigurator(argc, argv));
}

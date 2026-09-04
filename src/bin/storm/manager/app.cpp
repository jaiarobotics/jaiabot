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

#include <goby/middleware/application/configurator.h>
#include <goby/middleware/application/multi_thread.h>
#include <goby/middleware/group.h>

#include "jaiabot/intervehicle.h"

#include "storm_manager.h"

namespace jaiabot
{
namespace apps
{

class StormManagerConfigurator : public goby::middleware::ProtobufConfigurator<config::StormManager>
{
  public:
    StormManagerConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<config::StormManager>(argc, argv)
    {
        auto& cfg = mutable_cfg();
    }
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::StormManager>(
        jaiabot::apps::StormManagerConfigurator(argc, argv));
}

// Copyright 2024:
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

#include <goby/middleware/application/configuration_reader.h>
#include <goby/middleware/application/interface.h>
#include <goby/middleware/application/tool.h>

#include "config.pb.h"

using goby::glog;

namespace jaiabot
{
namespace apps
{
class Tool : public goby::middleware::Application<jaiabot::config::Tool>
{
  public:
    Tool();
    ~Tool() override {}

  private:
    // never gets called
    void run() override {}

  private:
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Tool>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Tool>(argc, argv));
}

jaiabot::apps::Tool::Tool()
{
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), app_cfg().app().tool_cfg());

    tool_helper.perform_action(app_cfg().action(), jaiabot::config::Tool::Action_descriptor());

    switch (app_cfg().action())
    {
        case jaiabot::config::Tool::help:
            tool_helper.help(jaiabot::config::Tool::Action_descriptor());
            break;

        default:
            // perform action will call 'exec' if an external tool performs the action,
            // so if we are continuing, this didn't happen
            throw(goby::Exception("Action was expected to be handled by external tool"));
            break;
    }

    quit(0);
}

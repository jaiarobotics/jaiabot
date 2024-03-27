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

#ifndef JAIABOT_SRC_BIN_TOOL_ACTIONS_CTL_H
#define JAIABOT_SRC_BIN_TOOL_ACTIONS_CTL_H

#include "goby/middleware/application/interface.h"

#include "actions/ctl.pb.h"

namespace jaiabot
{
namespace apps
{
class CtlToolConfigurator : public goby::middleware::ProtobufConfigurator<jaiabot::config::CtlTool>
{
  public:
    CtlToolConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<jaiabot::config::CtlTool>(argc, argv)
    {
        auto& cfg = mutable_cfg();
        // if no additional parameters are given by the user, append jaiabot.service for convenience
        if (cfg.app().tool_cfg().extra_cli_param().size() == 0)
            cfg.mutable_app()->mutable_tool_cfg()->add_extra_cli_param("jaiabot.service");
    }
};

class CtlTool : public goby::middleware::Application<jaiabot::config::CtlTool>
{
  public:
    CtlTool();
    ~CtlTool() override {}

  private:
    void run() override { assert(false); }

  private:
};

} // namespace apps
} // namespace jaiabot
#endif

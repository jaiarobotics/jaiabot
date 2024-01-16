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

#ifndef JAIABOT_SRC_BIN_TOOL_ACTIONS_VERSION_H
#define JAIABOT_SRC_BIN_TOOL_ACTIONS_VERSION_H

#include "goby/middleware/application/interface.h"

#include "actions/version.pb.h"

namespace jaiabot
{
namespace apps
{
class VersionToolConfigurator
    : public goby::middleware::ProtobufConfigurator<jaiabot::config::VersionTool>
{
  public:
    VersionToolConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<jaiabot::config::VersionTool>(argc, argv)
    {
        auto& cfg = mutable_cfg();
        // no explicit versions implies all versions
        if (cfg.display_version_size() == 0)
        {
            for (int i = jaiabot::config::VersionTool::Version_MIN,
                     n = jaiabot::config::VersionTool::Version_MAX;
                 i <= n; ++i)
            {
                if (jaiabot::config::VersionTool::Version_IsValid(i))
                    cfg.add_display_version(static_cast<jaiabot::config::VersionTool::Version>(i));
            }
        }
    }
};

class VersionTool : public goby::middleware::Application<jaiabot::config::VersionTool>
{
  public:
    VersionTool();
    ~VersionTool() override {}

  private:
    void run() override { assert(false); }

  private:
};

} // namespace apps
} // namespace jaiabot
#endif

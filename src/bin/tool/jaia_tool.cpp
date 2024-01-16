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

#include "actions/ctl.h"
#include "actions/version.h"
#include "config.pb.h"

using goby::glog;

namespace jaiabot
{
namespace apps
{
class ToolConfigurator : public goby::middleware::ProtobufConfigurator<jaiabot::config::Tool>
{
  public:
    ToolConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<jaiabot::config::Tool>(argc, argv)
    {
        auto& cfg = mutable_cfg();
        if (!cfg.app().glog_config().has_tty_verbosity())
            cfg.mutable_app()->mutable_glog_config()->set_tty_verbosity(
                goby::util::protobuf::GLogConfig::WARN);
    }
};

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
    return goby::run<jaiabot::apps::Tool>(jaiabot::apps::ToolConfigurator(argc, argv));
}

jaiabot::apps::Tool::Tool()
{
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), app_cfg().app().tool_cfg(),
                                             jaiabot::config::Tool::Action_descriptor());

    if (!tool_helper.perform_action(app_cfg().action()))
    {
        switch (app_cfg().action())
        {
            case jaiabot::config::Tool::help:
                int action_for_help;
                if (!tool_helper.help(&action_for_help))
                {
                    switch (action_for_help)
                    {
                            // case jaiabot::config::Tool::log:
                            //     throw(goby::Exception("jaia log not yet implemented"));
                            //     break;

                        case jaiabot::config::Tool::version:
                            tool_helper.help<jaiabot::apps::VersionTool,
                                             jaiabot::apps::VersionToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::Tool::ctl:
                            tool_helper
                                .help<jaiabot::apps::CtlTool, jaiabot::apps::CtlToolConfigurator>(
                                    action_for_help);
                            break;

                        default:
                            throw(goby::Exception(
                                "Help was expected to be handled by external tool"));
                            break;
                    }
                }
                break;

                // case jaiabot::config::Tool::log:
                //     throw(goby::Exception("jaia log not yet implemented"));
                //     break;

            case jaiabot::config::Tool::version:
                tool_helper.run_subtool<jaiabot::apps::VersionTool,
                                        jaiabot::apps::VersionToolConfigurator>();
                break;

            case jaiabot::config::Tool::ctl:
                tool_helper
                    .run_subtool<jaiabot::apps::CtlTool, jaiabot::apps::CtlToolConfigurator>();
                break;
            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

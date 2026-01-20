// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Michael Twomey <michael.twomey@jaia.tech>
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
#include <filesystem>
#include <fstream>
#include <chrono>
#include <string>
#include <format>
#include <google/protobuf/util/json_util.h>

#include "config.pb.h"
#include "jaiabot/messages/ctd.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/groups.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase =
    goby::zeromq::SingleThreadApplication<jaiabot::config::CTDManager>;

namespace jaiabot
{
namespace apps
{
class CTDManager : public ApplicationBase
{
  public:
    CTDManager();
  private:
    void handle_ctd_profile(const jaiabot::protobuf::CTDProfile& ctd_profile);
    void handle_ctd_offload_command(const jaiabot::protobuf::Command& command);
};
} // namespace apps
} // namespace jaiabot

jaiabot::apps::CTDManager::CTDManager() : ApplicationBase() 
{
  interprocess().subscribe<jaiabot::groups::ctd>(
    [this](const jaiabot::protobuf::CTDProfile& ctd_profile) {
      glog.is_debug1() && glog << "Received CTD Profile" << std::endl;
      handle_ctd_profile(ctd_profile);
    }
  );

  interprocess().subscribe<jaiabot::groups::ctd>(
    [this](const jaiabot::protobuf::Command& command) {
      glog.is_debug1() && glog << "Received CTD command" << std::endl;
      handle_ctd_offload_command(command);
    }
  );
}

void jaiabot::apps::CTDManager::handle_ctd_profile(const jaiabot::protobuf::CTDProfile& ctd_profile) 
{
    std::string time;
    if (ctd_profile.snapshot_size() > 0)
    {
      auto seconds = std::chrono::duration_cast<std::chrono::seconds>(std::chrono::microseconds{ctd_profile.snapshot(0).time()});
      auto time_point = std::chrono::sys_time<std::chrono::seconds>{seconds};
      auto local = std::chrono::zoned_time{std::chrono::current_zone(), time_point};
      time = std::format("{:%Y%m%dT%H%M%S}", local);
    }
    else 
    {
      return;
    }

    std::filesystem::path path = 
      std::filesystem::path("/var/log/jaiabot/bot") /
      std::to_string(ctd_profile.bot_id()) / 
      "ctd" / ("bot" + std::to_string(ctd_profile.bot_id()) + "_" + time + ".ctd.json");
    
    std::string json;
    google::protobuf::util::MessageToJsonString(ctd_profile, &json);
    std::ofstream out(path);
    out << json;
    out.close();
}

void jaiabot::apps::CTDManager::handle_ctd_offload_command(const jaiabot::protobuf::Command& command) 
{
    std::string bot_ip = cfg().class_b_network() + "." + std::to_string(cfg().fleet_id()) + "." +
                         std::to_string((cfg().bot_start_ip() + command.bot_id()));
    
    if (cfg().use_localhost_for_data_offload())
        bot_ip = "127.0.0.1";
    
    std::string offload_command = cfg().offload_script() + " -bot_id " + std::to_string(command.bot_id()) +
                                  " -bot_ip " + bot_ip + " 2>&1";

                  

    glog.is_debug1() && glog << "Offload command: " << offload_command << std::endl;

    FILE* pipe = popen(offload_command.c_str(), "r");
    if (!pipe)
    {
        glog.is_warn() && glog << "Error opening pipe to CTD offload command: "
                                << strerror(errno) << std::endl;
    }
}

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::CTDManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::CTDManager>(argc, argv));
}

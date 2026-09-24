// Copyright 2026:
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
#include <chrono>
#include <cmath>
#include <filesystem>
#include <format>
#include <fstream>
#include <goby/zeromq/application/single_thread.h>
#include <google/protobuf/util/json_util.h>
#include <sstream>
#include <string>
#include <vector>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/ctd.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/utils/downsample.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::CTDManager>;

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
    std::vector<std::string> convert_proto_to_unb(const jaiabot::protobuf::CTDProfile& ctd_profile,
                                                  std::filesystem::path file, std::string time);
    const double ascent_epsilon{0.5};
    static constexpr std::size_t iridium_profile_max_bytes{180};
};
} // namespace apps
} // namespace jaiabot

jaiabot::apps::CTDManager::CTDManager() : ApplicationBase()
{
    interprocess().subscribe<jaiabot::groups::ctd>(
        [this](const jaiabot::protobuf::CTDProfile& ctd_profile)
        {
            glog.is_debug1() && glog << "Received CTD Profile" << std::endl;
            handle_ctd_profile(ctd_profile);
        });
}

void jaiabot::apps::CTDManager::handle_ctd_profile(const jaiabot::protobuf::CTDProfile& ctd_profile)
{
    std::string time;

    if (ctd_profile.snapshot_size() > 0)
    {
        time = goby::time::file_str();
    }
    else
    {
        return;
    }

    double bottom_depth = ctd_profile.snapshot(0).depth();
    double top_depth = ctd_profile.snapshot(ctd_profile.snapshot_size() - 1).depth();

    glog.is_debug1() && glog << "bottom_depth: " << bottom_depth << std::endl;
    glog.is_debug1() && glog << "top_depth: " << top_depth << std::endl;

    // bot stuck on bottom, discard data
    if (bottom_depth - top_depth < ascent_epsilon)
    {
        return;
    }

    std::filesystem::path base = std::filesystem::path(cfg().log_dir());
    std::filesystem::path file =
        base / ("bot" + std::to_string(ctd_profile.bot_id()) + "_" + time + ".unb");
    const auto unb_lines = convert_proto_to_unb(ctd_profile, file, time);

    if (cfg().iridium_offload())
    {
        const auto downsampled_lines = jaiabot::utils::downsampleDatasetToMaxBytes(
            unb_lines, iridium_profile_max_bytes, 4, [](const std::vector<double>& values)
            { return values[0]; }, [](const std::vector<double>& values) { return values[3]; });

        std::ostringstream serialized_profile;
        for (std::size_t i = 0; i < downsampled_lines.size(); ++i)
        {
            if (i > 0)
                serialized_profile << '\n';
            serialized_profile << downsampled_lines[i];
        }

        jaiabot::protobuf::TaskPacket task_packet;
        task_packet.set_bot_id(ctd_profile.bot_id());
        task_packet.set_start_time(ctd_profile.snapshot(0).time());
        task_packet.set_end_time(ctd_profile.snapshot(ctd_profile.snapshot_size() - 1).time());
        task_packet.set_type(jaiabot::protobuf::MissionTask::STORM_CTD_PROFILE);
        task_packet.set_storm_ctd_profile(serialized_profile.str());
        interprocess().publish<jaiabot::groups::task_packet>(task_packet);
    }
}

std::vector<std::string>
jaiabot::apps::CTDManager::convert_proto_to_unb(const jaiabot::protobuf::CTDProfile& ctd_profile,
                                                std::filesystem::path file, std::string time)
{
    glog.is_debug1() && glog << "Starting .proto to .unb conversion" << std::endl;
    const int unb_version = 2;
    const std::string date_logging = "0000 000 00:00:00";
    const std::string ship_location = "0.000000 0.000000";
    const int num_obs = ctd_profile.snapshot().size();

    std::vector<std::string> lines;
    lines.reserve(5 + num_obs);
    lines.push_back(std::to_string(unb_version));
    lines.push_back(time);
    lines.push_back(date_logging);
    lines.push_back(std::to_string(ctd_profile.location().lat()) + " " +
                    std::to_string(ctd_profile.location().lon()));
    lines.push_back(ship_location);

    for (int i = 0; i < ctd_profile.snapshot().size(); i++)
    {
        const jaiabot::protobuf::CTDSnapshot& snapshot = ctd_profile.snapshot()[i];
        lines.push_back(std::to_string(i) + " " + std::to_string(snapshot.depth()) + " " +
                        "0.000 " + std::to_string(snapshot.temperature()) + " " +
                        std::to_string(snapshot.salinity()));
    }

    std::ofstream out(file);
    for (const auto& line : lines) out << line << '\n';
    out.close();
    glog.is_debug1() && glog << "Completed .proto to .unb conversion" << std::endl;
    return lines;
}

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::CTDManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::CTDManager>(argc, argv));
}

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
#include <algorithm>
#include <chrono>
#include <cmath>
#include <filesystem>
#include <format>
#include <fstream>
#include <goby/zeromq/application/single_thread.h>
#include <google/protobuf/util/json_util.h>
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
    goby::time::MicroTime profile_time;

    if (ctd_profile.snapshot_size() > 0)
    {
        profile_time = goby::time::SystemClock::now<goby::time::MicroTime>();
        time = goby::time::file_str(profile_time);
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
    convert_proto_to_unb(ctd_profile, file, time);

    if (cfg().iridium_offload())
    {
        const auto* profile_desc = jaiabot::protobuf::StormCTDProfile::descriptor();
        const std::size_t samples_per_part = profile_desc->FindFieldByName("sample")
                                                 ->options()
                                                 .GetExtension(dccl::field)
                                                 .max_repeat();
        const std::size_t max_parts = static_cast<std::size_t>(
            profile_desc->FindFieldByName("num_parts")->options().GetExtension(dccl::field).max());
        const std::size_t max_samples = std::clamp<std::size_t>(cfg().iridium_offload_max_samples(),
                                                                2, samples_per_part * max_parts);

        std::vector<jaiabot::utils::Point> profile_points;
        profile_points.reserve(ctd_profile.snapshot_size());
        for (const auto& snapshot : ctd_profile.snapshot())
        {
            profile_points.push_back({snapshot.depth(), snapshot.salinity()});
        }

        const auto selected_indices =
            jaiabot::utils::downsampleIndices(profile_points, max_samples);
        const std::size_t num_parts =
            (selected_indices.size() + samples_per_part - 1) / samples_per_part;

        const auto bounded_value = [](double value, double minimum, double maximum)
        {
            if (!std::isfinite(value))
                return minimum;
            return std::clamp(value, minimum, maximum);
        };

        for (std::size_t part = 0; part < num_parts; ++part)
        {
            const auto begin = selected_indices.begin() + part * samples_per_part;
            const auto end = selected_indices.begin() +
                             std::min(selected_indices.size(), (part + 1) * samples_per_part);

            jaiabot::protobuf::TaskPacket task_packet;
            task_packet.set_bot_id(ctd_profile.bot_id());
            // each part needs its own start_time: the hub discards TaskPackets whose
            // start_time it has already seen for this bot
            task_packet.set_start_time(ctd_profile.snapshot(*begin).time());
            task_packet.set_end_time(ctd_profile.snapshot(*(end - 1)).time());
            task_packet.set_type(jaiabot::protobuf::MissionTask::STORM_CTD_PROFILE);
            auto* storm_ctd_profile = task_packet.mutable_storm_ctd_profile();
            storm_ctd_profile->set_profile_time_with_units(profile_time);
            storm_ctd_profile->mutable_location()->CopyFrom(ctd_profile.location());
            storm_ctd_profile->set_part_index(part);
            storm_ctd_profile->set_num_parts(num_parts);
            for (auto it = begin; it != end; ++it)
            {
                const auto& snapshot = ctd_profile.snapshot(*it);
                auto* sample = storm_ctd_profile->add_sample();
                sample->set_depth(bounded_value(snapshot.depth(), 0, 100));
                sample->set_temperature(bounded_value(snapshot.temperature(), -10, 50));
                sample->set_salinity(bounded_value(snapshot.salinity(), 0, 60));
            }
            interprocess().publish<jaiabot::groups::task_packet>(task_packet);
        }
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

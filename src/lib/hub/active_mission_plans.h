#ifndef JAIABOT_SRC_LIB_HUB_ACTIVE_MISSION_PLANS_H
#define JAIABOT_SRC_LIB_HUB_ACTIVE_MISSION_PLANS_H

#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <map>
#include <stdexcept>
#include <vector>

#include <dccl/option_extensions.pb.h>

#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/portal.pb.h"

namespace jaiabot
{
namespace hub
{
/// \brief The latest MISSION_PLAN command sent to each bot
class ActiveMissionPlans
{
  public:
    /// \return true if the command became its bot's active mission plan
    bool update(const protobuf::Command& command)
    {
        if (command.type() != protobuf::Command::MISSION_PLAN)
            return false;

        auto it = commands_.find(command.bot_id());
        if (it != commands_.end() &&
            rounded_time(command.time()) <= rounded_time(it->second.time()))
            return false;

        commands_[command.bot_id()] = command;
        return true;
    }

    protobuf::ActiveMissionPlans to_message() const
    {
        protobuf::ActiveMissionPlans message;
        for (const auto& [bot_id, command] : commands_) *message.add_command() = command;
        return message;
    }

    protobuf::Hub2HubActiveMissionSummary summary(std::uint32_t hub_id) const
    {
        protobuf::Hub2HubActiveMissionSummary summary;
        summary.set_hub_id(hub_id);
        for (const auto& [bot_id, command] : commands_)
        {
            auto& active_mission = *summary.add_active_mission();
            active_mission.set_bot_id(bot_id);
            active_mission.set_command_time(command.time());
        }
        return summary;
    }

    /// \return the plans that summary lacks or holds an older command time for
    std::vector<protobuf::Command>
    newer_than(const protobuf::Hub2HubActiveMissionSummary& summary) const
    {
        std::map<std::uint32_t, std::uint64_t> summary_times;
        for (const auto& active_mission : summary.active_mission())
            summary_times[active_mission.bot_id()] = rounded_time(active_mission.command_time());

        std::vector<protobuf::Command> newer;
        for (const auto& [bot_id, command] : commands_)
        {
            auto it = summary_times.find(bot_id);
            if (it == summary_times.end() || rounded_time(command.time()) > it->second)
                newer.push_back(command);
        }
        return newer;
    }

    /// \brief Writes the plans to path, replacing the file only once the write has succeeded
    void save(const std::filesystem::path& path) const
    {
        std::filesystem::create_directories(path.parent_path());
        const auto temporary_path = path.string() + ".tmp";

        std::ofstream file(temporary_path, std::ios::binary | std::ios::trunc);
        if (!file || !to_message().SerializeToOstream(&file))
            throw std::runtime_error("failed to write " + temporary_path);
        file.close();
        if (!file)
            throw std::runtime_error("failed to write " + temporary_path);

        std::filesystem::rename(temporary_path, path);
    }

    /// \brief Replaces the plans with those saved at path; no file means no plans
    void load(const std::filesystem::path& path)
    {
        commands_.clear();
        if (!std::filesystem::exists(path))
            return;

        std::ifstream file(path, std::ios::binary);
        protobuf::ActiveMissionPlans message;
        if (!file || !message.ParseFromIstream(&file))
            throw std::runtime_error("failed to read " + path.string());

        for (const auto& command : message.command()) update(command);
    }

  private:
    // relayed commands arrive with their time rounded to the DCCL precision
    static std::uint64_t rounded_time(std::uint64_t time)
    {
        static const auto resolution =
            static_cast<std::uint64_t>(std::pow(10, -protobuf::Command::descriptor()
                                                         ->FindFieldByName("time")
                                                         ->options()
                                                         .GetExtension(dccl::field)
                                                         .precision()));
        return (time + resolution / 2) / resolution;
    }

    std::map<std::uint32_t, protobuf::Command> commands_;
};

} // namespace hub
} // namespace jaiabot

#endif

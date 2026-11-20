#ifndef JAIABOT_SRC_LIB_HUB_ACTIVE_MISSION_PLANS_H
#define JAIABOT_SRC_LIB_HUB_ACTIVE_MISSION_PLANS_H

#include <cstdint>
#include <map>
#include <vector>

#include "jaiabot/comms/dccl_time.h"
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
        // relayed copies arrive with their time rounded by DCCL
        if (it != commands_.end() &&
            comms::dccl_time2_round(command.time()) <= comms::dccl_time2_round(it->second.time()))
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
            summary_times[active_mission.bot_id()] =
                comms::dccl_time2_round(active_mission.command_time());

        std::vector<protobuf::Command> newer;
        for (const auto& [bot_id, command] : commands_)
        {
            auto it = summary_times.find(bot_id);
            if (it == summary_times.end() || comms::dccl_time2_round(command.time()) > it->second)
                newer.push_back(command);
        }
        return newer;
    }

  private:
    std::map<std::uint32_t, protobuf::Command> commands_;
};

} // namespace hub
} // namespace jaiabot

#endif

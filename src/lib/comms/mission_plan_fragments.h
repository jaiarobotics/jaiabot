#ifndef JAIABOT_SRC_LIB_COMMS_MISSION_PLAN_FRAGMENTS_H
#define JAIABOT_SRC_LIB_COMMS_MISSION_PLAN_FRAGMENTS_H

#include <algorithm>
#include <cstdint>
#include <map>
#include <optional>
#include <vector>

#include <dccl/option_extensions.pb.h>

#include "jaiabot/messages/jaia_dccl.pb.h"

namespace jaiabot
{
namespace comms
{
inline int mission_plan_goals_per_fragment()
{
    return protobuf::MissionPlan::descriptor()
        ->FindFieldByName("goal")
        ->options()
        .GetExtension(dccl::field)
        .max_repeat();
}

/// \brief Splits a MISSION_PLAN with more goals than one Command can carry into MISSION_PLAN_FRAGMENT commands
/// \return the fragments in order, or an empty vector if the command doesn't need splitting
inline std::vector<protobuf::Command> fragment_mission_plan(const protobuf::Command& command)
{
    const int goals_per_fragment = mission_plan_goals_per_fragment();
    const auto& plan = command.plan();

    if (command.type() != protobuf::Command::MISSION_PLAN || plan.goal_size() <= goals_per_fragment)
        return {};

    const int expected_fragments = (plan.goal_size() + goals_per_fragment - 1) / goals_per_fragment;

    std::vector<protobuf::Command> fragments;
    for (int fragment_index = 0; fragment_index < expected_fragments; ++fragment_index)
    {
        protobuf::Command fragment;
        fragment.set_bot_id(command.bot_id());
        fragment.set_time(command.time());
        fragment.set_type(protobuf::Command::MISSION_PLAN_FRAGMENT);
        auto& fragment_plan = *fragment.mutable_plan();

        if (fragment_index == 0)
        {
            if (plan.has_start())
                fragment_plan.set_start(plan.start());
            if (plan.has_movement())
                fragment_plan.set_movement(plan.movement());
            if (plan.has_recovery())
                *fragment_plan.mutable_recovery() = plan.recovery();
            if (plan.has_speeds())
                *fragment_plan.mutable_speeds() = plan.speeds();
            if (plan.has_repeats())
                fragment_plan.set_repeats(plan.repeats());
            if (plan.has_bottom_depth_safety_params())
                *fragment_plan.mutable_bottom_depth_safety_params() =
                    plan.bottom_depth_safety_params();
            if (plan.has_mission_name())
                fragment_plan.set_mission_name(plan.mission_name());
            *fragment_plan.mutable_segments() = plan.segments();
        }

        fragment_plan.set_fragment_index(fragment_index);
        fragment_plan.set_expected_fragments(expected_fragments);

        const int end_goal_index =
            std::min(plan.goal_size(), (fragment_index + 1) * goals_per_fragment);
        for (int goal_index = fragment_index * goals_per_fragment; goal_index < end_goal_index;
             ++goal_index)
        {
            const auto& goal = plan.goal(goal_index);
            auto& fragment_goal = *fragment_plan.add_goal();
            if (goal.has_name())
                fragment_goal.set_name(goal.name());
            if (goal.has_task())
                *fragment_goal.mutable_task() = goal.task();
            *fragment_goal.mutable_location() = goal.location();
        }

        fragments.push_back(fragment);
    }
    return fragments;
}

/// \brief Reassembles MISSION_PLAN_FRAGMENT commands into the MISSION_PLAN they were split from, keeping only the newest command time for each bot
class MissionPlanAssembler
{
  public:
    /// \return the MISSION_PLAN when this fragment completes it, otherwise std::nullopt (including for fragments of a plan already returned)
    std::optional<protobuf::Command> add(const protobuf::Command& fragment)
    {
        auto& pending = pending_[fragment.bot_id()];
        if (fragment.time() < pending.time)
            return std::nullopt;
        if (fragment.time() > pending.time)
            pending = Pending{fragment.time(), {}, false};

        if (pending.assembled ||
            !pending.fragments.emplace(fragment.plan().fragment_index(), fragment).second)
            return std::nullopt;

        if (pending.fragments.size() != fragment.plan().expected_fragments() ||
            pending.fragments.begin()->first != 0 ||
            pending.fragments.rbegin()->first != fragment.plan().expected_fragments() - 1)
            return std::nullopt;

        pending.assembled = true;

        protobuf::Command command = pending.fragments.at(0);
        command.set_type(protobuf::Command::MISSION_PLAN);
        auto& plan = *command.mutable_plan();
        plan.clear_fragment_index();
        plan.clear_expected_fragments();
        for (auto it = std::next(pending.fragments.begin()); it != pending.fragments.end(); ++it)
        {
            for (const auto& goal : it->second.plan().goal()) *plan.add_goal() = goal;
        }
        return command;
    }

  private:
    struct Pending
    {
        std::uint64_t time{0};
        std::map<std::uint32_t, protobuf::Command> fragments;
        bool assembled{false};
    };
    std::map<std::uint32_t, Pending> pending_;
};

} // namespace comms
} // namespace jaiabot

#endif

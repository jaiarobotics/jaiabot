#define BOOST_TEST_MODULE jaiabot_test_comms_mission_plan_fragments
#include <boost/test/included/unit_test.hpp>

#include <dccl/codec.h>
#include <google/protobuf/util/field_comparator.h>
#include <google/protobuf/util/message_differencer.h>

#include "jaiabot/comms/mission_plan_fragments.h"

namespace jaiabot
{
namespace comms
{
using protobuf::Command;

constexpr std::uint64_t command_time = 1794410386000000;

Command make_mission_plan(int number_of_goals, int bot_id = 1, std::uint64_t time = command_time)
{
    Command command;
    command.set_bot_id(bot_id);
    command.set_time(time);
    command.set_type(Command::MISSION_PLAN);

    auto& plan = *command.mutable_plan();
    plan.set_start(protobuf::MissionPlan::START_IMMEDIATELY);
    plan.set_movement(protobuf::MissionPlan::TRANSIT);
    plan.mutable_recovery()->set_recover_at_final_goal(true);
    plan.set_repeats(2);
    plan.set_mission_name("survey");
    for (int i = 0; i < number_of_goals; ++i)
    {
        auto& goal = *plan.add_goal();
        goal.mutable_location()->set_lat(41.6624 + 0.0002 * (i / 5));
        goal.mutable_location()->set_lon(-71.2723 + 0.0002 * (i % 5));
        if (i % 3 == 0)
            goal.mutable_task()->set_type(protobuf::MissionTask::DIVE);
    }
    return command;
}

std::vector<Command> reversed(std::vector<Command> fragments)
{
    std::reverse(fragments.begin(), fragments.end());
    return fragments;
}

bool plans_match(const protobuf::MissionPlan& expected, const protobuf::MissionPlan& actual)
{
    google::protobuf::util::DefaultFieldComparator comparator;
    // DCCL rounds coordinates to its encoded precision
    comparator.set_float_comparison(google::protobuf::util::DefaultFieldComparator::APPROXIMATE);
    comparator.SetDefaultFractionAndMargin(0, 1e-5);

    google::protobuf::util::MessageDifferencer differencer;
    differencer.set_field_comparator(&comparator);
    std::string report;
    differencer.ReportDifferencesToString(&report);
    bool match = differencer.Compare(expected, actual);
    BOOST_TEST_MESSAGE(report);
    return match;
}

BOOST_AUTO_TEST_SUITE(fragment_mission_plan_tests)

BOOST_AUTO_TEST_CASE(plan_within_one_command_is_not_split)
{
    BOOST_CHECK(
        fragment_mission_plan(make_mission_plan(mission_plan_goals_per_fragment())).empty());
}

BOOST_AUTO_TEST_CASE(other_command_types_are_not_split)
{
    auto command = make_mission_plan(25);
    command.set_type(Command::MISSION_PLAN_FRAGMENT);
    BOOST_CHECK(fragment_mission_plan(command).empty());
}

BOOST_AUTO_TEST_CASE(large_plan_is_split_in_goal_order)
{
    const auto command = make_mission_plan(25);
    const auto fragments = fragment_mission_plan(command);

    BOOST_REQUIRE_EQUAL(fragments.size(), 3);
    const std::vector<int> expected_goal_counts{10, 10, 5};
    int goal_index = 0;
    for (std::size_t i = 0; i < fragments.size(); ++i)
    {
        const auto& fragment = fragments[i];
        BOOST_CHECK_EQUAL(fragment.type(), Command::MISSION_PLAN_FRAGMENT);
        BOOST_CHECK_EQUAL(fragment.bot_id(), command.bot_id());
        BOOST_CHECK_EQUAL(fragment.time(), command.time());
        BOOST_CHECK_EQUAL(fragment.plan().fragment_index(), i);
        BOOST_CHECK_EQUAL(fragment.plan().expected_fragments(), 3);
        BOOST_CHECK_EQUAL(fragment.plan().has_mission_name(), i == 0);
        BOOST_REQUIRE_EQUAL(fragment.plan().goal_size(), expected_goal_counts[i]);
        for (const auto& goal : fragment.plan().goal())
            BOOST_CHECK_EQUAL(goal.location().lon(),
                              command.plan().goal(goal_index++).location().lon());
    }
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(mission_plan_assembler_tests)

BOOST_AUTO_TEST_CASE(fragments_in_any_order_reassemble_once)
{
    const auto command = make_mission_plan(25);
    MissionPlanAssembler assembler;

    std::vector<std::optional<Command>> results;
    for (const auto& fragment : reversed(fragment_mission_plan(command)))
        results.push_back(assembler.add(fragment));

    BOOST_CHECK(!results[0]);
    BOOST_CHECK(!results[1]);
    BOOST_REQUIRE(results[2]);
    BOOST_CHECK_EQUAL(results[2]->type(), Command::MISSION_PLAN);
    BOOST_CHECK_EQUAL(results[2]->time(), command.time());
    BOOST_CHECK(plans_match(command.plan(), results[2]->plan()));

    for (const auto& fragment : fragment_mission_plan(command))
        BOOST_CHECK(!assembler.add(fragment));
}

BOOST_AUTO_TEST_CASE(interleaved_bots_reassemble_separately)
{
    const auto bot1 = fragment_mission_plan(make_mission_plan(15, 1));
    const auto bot2 = fragment_mission_plan(make_mission_plan(25, 2));
    MissionPlanAssembler assembler;

    BOOST_CHECK(!assembler.add(bot1[0]));
    BOOST_CHECK(!assembler.add(bot2[0]));
    BOOST_CHECK(!assembler.add(bot2[1]));
    auto bot1_plan = assembler.add(bot1[1]);
    auto bot2_plan = assembler.add(bot2[2]);

    BOOST_REQUIRE(bot1_plan);
    BOOST_REQUIRE(bot2_plan);
    BOOST_CHECK_EQUAL(bot1_plan->plan().goal_size(), 15);
    BOOST_CHECK_EQUAL(bot2_plan->plan().goal_size(), 25);
}

BOOST_AUTO_TEST_CASE(newer_command_replaces_unfinished_one)
{
    const auto older = fragment_mission_plan(make_mission_plan(25, 1, command_time));
    const auto newer = fragment_mission_plan(make_mission_plan(15, 1, command_time + 1000000));
    MissionPlanAssembler assembler;

    BOOST_CHECK(!assembler.add(older[0]));
    BOOST_CHECK(!assembler.add(newer[0]));
    BOOST_CHECK(!assembler.add(older[1]));
    BOOST_CHECK(!assembler.add(older[2]));

    auto newer_plan = assembler.add(newer[1]);
    BOOST_REQUIRE(newer_plan);
    BOOST_CHECK_EQUAL(newer_plan->time(), command_time + 1000000);
    BOOST_CHECK_EQUAL(newer_plan->plan().goal_size(), 15);
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(hub2hub_relay_tests)

template <typename Message> Message round_trip(const Message& message, dccl::Codec& codec)
{
    std::string bytes;
    codec.encode(&bytes, message);
    Message received;
    codec.decode(bytes, &received);
    return received;
}

Command with_mission_name(Command command, const std::string& mission_name)
{
    if (!mission_name.empty())
        command.mutable_plan()->set_mission_name(mission_name);
    return command;
}

Command relay_as_hub2hub_data(const Command& command, dccl::Codec& codec)
{
    protobuf::Hub2HubData hub2hub_data;
    hub2hub_data.set_hub_id(1);
    hub2hub_data.set_time(command_time);
    *hub2hub_data.mutable_command_for_bot() = command;
    if (command.plan().has_mission_name())
        hub2hub_data.set_mission_name(command.plan().mission_name());

    const auto received = round_trip(hub2hub_data, codec);
    return with_mission_name(received.command_for_bot(), received.mission_name());
}

Command relay_as_active_mission(const Command& command, dccl::Codec& codec)
{
    protobuf::Hub2HubActiveMission active_mission;
    active_mission.set_hub_id(1);
    *active_mission.mutable_command() = command;
    active_mission.set_command_time(command.time());
    if (command.plan().has_mission_name())
        active_mission.set_mission_name(command.plan().mission_name());

    const auto received = round_trip(active_mission, codec);
    auto received_command = with_mission_name(received.command(), received.mission_name());
    received_command.set_time(received.command_time());
    return received_command;
}

BOOST_AUTO_TEST_CASE(large_plan_relayed_as_fragments_arrives_complete)
{
    dccl::Codec codec;
    // strict mode throws instead of silently dropping goals beyond max_repeat
    codec.set_strict(true);
    codec.load<protobuf::Hub2HubData>();
    codec.load<protobuf::Hub2HubActiveMission>();

    const int max_fragments = protobuf::MissionPlan::descriptor()
                                  ->FindFieldByName("expected_fragments")
                                  ->options()
                                  .GetExtension(dccl::field)
                                  .max();
    const int max_goals = mission_plan_goals_per_fragment() * max_fragments;

    const std::vector<std::pair<std::string, Command (*)(const Command&, dccl::Codec&)>> relays{
        {"Hub2HubData", relay_as_hub2hub_data}, {"Hub2HubActiveMission", relay_as_active_mission}};

    for (const auto& [message_name, relay] : relays)
    {
        for (int number_of_goals : {11, 25, max_goals})
        {
            BOOST_TEST_CONTEXT(message_name << ", goals: " << number_of_goals)
            {
                const auto command = make_mission_plan(number_of_goals);
                MissionPlanAssembler assembler;
                std::optional<Command> received;
                for (const auto& fragment : fragment_mission_plan(command))
                    BOOST_REQUIRE_NO_THROW(received = assembler.add(relay(fragment, codec)));

                BOOST_REQUIRE(received);
                BOOST_CHECK(plans_match(command.plan(), received->plan()));
            }
        }
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace comms
} // namespace jaiabot

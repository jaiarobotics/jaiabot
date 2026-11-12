#define BOOST_TEST_MODULE jaiabot_test_comms_hub2hub_messages
#include <boost/test/included/unit_test.hpp>

#include <chrono>

#include <dccl/codec.h>

#include "jaiabot/messages/jaia_dccl.pb.h"

namespace jaiabot
{
namespace protobuf
{
// DCCL's time codec decodes to the day nearest the current time
const std::uint64_t command_time = std::chrono::duration_cast<std::chrono::seconds>(
                                       std::chrono::system_clock::now().time_since_epoch())
                                       .count() *
                                   1000000;

Command make_mission_plan()
{
    Command command;
    command.set_bot_id(1);
    command.set_time(command_time);
    command.set_type(Command::MISSION_PLAN);
    auto& plan = *command.mutable_plan();
    plan.set_start(MissionPlan::START_IMMEDIATELY);
    plan.set_movement(MissionPlan::TRANSIT);
    for (int i = 0; i < 10; ++i)
    {
        auto& location = *plan.add_goal()->mutable_location();
        location.set_lat(41.6624 + 0.0002 * i);
        location.set_lon(-71.2723);
    }
    return command;
}

struct StrictCodec
{
    StrictCodec()
    {
        // strict mode throws instead of silently truncating out-of-range values
        codec.set_strict(true);
        codec.load<Hub2HubData>();
        codec.load<Hub2HubActiveMission>();
    }

    template <typename Message> Message round_trip(const Message& message)
    {
        std::string bytes;
        codec.encode(&bytes, message);
        Message decoded;
        codec.decode(bytes, &decoded);
        return decoded;
    }

    dccl::Codec codec;
};

const std::string longest_name(64, 'n');

BOOST_FIXTURE_TEST_SUITE(hub2hub_message_tests, StrictCodec)

BOOST_AUTO_TEST_CASE(relayed_command_carries_mission_name)
{
    Hub2HubData hub2hub_data;
    hub2hub_data.set_hub_id(1);
    hub2hub_data.set_time(command_time);
    *hub2hub_data.mutable_command_for_bot() = make_mission_plan();
    hub2hub_data.set_mission_name(longest_name);

    const auto received = round_trip(hub2hub_data);
    BOOST_CHECK_EQUAL(received.mission_name(), longest_name);
    BOOST_CHECK_EQUAL(received.command_for_bot().plan().goal_size(), 10);
}

BOOST_AUTO_TEST_CASE(active_mission_carries_command_and_name)
{
    Hub2HubActiveMission active_mission;
    active_mission.set_hub_id(2);
    *active_mission.mutable_command() = make_mission_plan();
    active_mission.set_command_time(command_time);
    active_mission.set_mission_name(longest_name);

    const auto received = round_trip(active_mission);
    BOOST_CHECK_EQUAL(received.hub_id(), 2);
    BOOST_CHECK_EQUAL(received.mission_name(), longest_name);
    BOOST_CHECK_EQUAL(received.command().time(), command_time);
    BOOST_CHECK_EQUAL(received.command().plan().goal_size(), 10);
}

BOOST_AUTO_TEST_CASE(active_mission_keeps_time_of_mission_days_old)
{
    const std::uint64_t days_old_time = command_time - 5ull * 24 * 60 * 60 * 1000000;
    Hub2HubActiveMission active_mission;
    active_mission.set_hub_id(2);
    *active_mission.mutable_command() = make_mission_plan();
    active_mission.mutable_command()->set_time(days_old_time);
    active_mission.set_command_time(days_old_time);

    const auto received = round_trip(active_mission);
    BOOST_CHECK_NE(received.command().time(), days_old_time);
    BOOST_CHECK_EQUAL(received.command_time(), days_old_time);
}

BOOST_AUTO_TEST_CASE(mission_name_longer_than_limit_is_rejected)
{
    Hub2HubActiveMission active_mission;
    active_mission.set_hub_id(2);
    *active_mission.mutable_command() = make_mission_plan();
    active_mission.set_command_time(command_time);
    active_mission.set_mission_name(longest_name + "n");

    std::string bytes;
    BOOST_CHECK_THROW(codec.encode(&bytes, active_mission), dccl::OutOfRangeException);
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace protobuf
} // namespace jaiabot

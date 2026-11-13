#define BOOST_TEST_MODULE jaiabot_test_hub_active_mission_plans
#include <boost/test/included/unit_test.hpp>

#include <filesystem>
#include <fstream>
#include <random>
#include <set>

#include "jaiabot/hub/active_mission_plans.h"

namespace jaiabot
{
namespace hub
{
using protobuf::Command;

constexpr std::uint64_t command_time = 1794410386000000;
constexpr std::uint64_t one_second = 1000000;

Command make_mission_plan(int bot_id, std::uint64_t time, const std::string& mission_name)
{
    Command command;
    command.set_bot_id(bot_id);
    command.set_time(time);
    command.set_type(Command::MISSION_PLAN);
    command.mutable_plan()->set_mission_name(mission_name);
    auto& location = *command.mutable_plan()->add_goal()->mutable_location();
    location.set_lat(41.66);
    location.set_lon(-71.27);
    return command;
}

std::map<std::uint32_t, std::string> mission_names(const ActiveMissionPlans& plans)
{
    std::map<std::uint32_t, std::string> names;
    for (const auto& command : plans.to_message().command())
        names[command.bot_id()] = command.plan().mission_name();
    return names;
}

struct TemporaryDirectory
{
    TemporaryDirectory()
        : path(std::filesystem::temp_directory_path() /
               ("jaiabot_test_active_mission_plans_" + std::to_string(std::random_device()())))
    {
        std::filesystem::create_directories(path);
    }
    ~TemporaryDirectory() { std::filesystem::remove_all(path); }

    std::filesystem::path path;
};

BOOST_AUTO_TEST_SUITE(update_tests)

BOOST_AUTO_TEST_CASE(newer_mission_plan_replaces_older)
{
    ActiveMissionPlans plans;
    BOOST_CHECK(plans.update(make_mission_plan(1, command_time, "first")));
    BOOST_CHECK(plans.update(make_mission_plan(1, command_time + one_second, "second")));
    BOOST_CHECK(mission_names(plans) == (std::map<std::uint32_t, std::string>{{1, "second"}}));
}

BOOST_AUTO_TEST_CASE(older_mission_plan_is_ignored)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time + one_second, "newer"));
    BOOST_CHECK(!plans.update(make_mission_plan(1, command_time, "older")));
    BOOST_CHECK(mission_names(plans) == (std::map<std::uint32_t, std::string>{{1, "newer"}}));
}

BOOST_AUTO_TEST_CASE(copy_with_rounded_time_is_ignored)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time + 300000, "original"));
    BOOST_CHECK(!plans.update(make_mission_plan(1, command_time, "relayed copy")));
    BOOST_CHECK(mission_names(plans) == (std::map<std::uint32_t, std::string>{{1, "original"}}));
}

BOOST_AUTO_TEST_CASE(other_command_types_are_ignored)
{
    ActiveMissionPlans plans;
    auto command = make_mission_plan(1, command_time, "fragment");
    command.set_type(Command::MISSION_PLAN_FRAGMENT);
    BOOST_CHECK(!plans.update(command));

    Command stop;
    stop.set_bot_id(1);
    stop.set_time(command_time);
    stop.set_type(Command::STOP);
    BOOST_CHECK(!plans.update(stop));

    BOOST_CHECK(plans.to_message().command().empty());
}

BOOST_AUTO_TEST_CASE(each_bot_keeps_its_own_plan)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(2, command_time + one_second, "bot 2"));
    plans.update(make_mission_plan(1, command_time, "bot 1"));
    BOOST_CHECK(mission_names(plans) ==
                (std::map<std::uint32_t, std::string>{{1, "bot 1"}, {2, "bot 2"}}));
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(persistence_tests)

BOOST_AUTO_TEST_CASE(saved_plans_load_back)
{
    TemporaryDirectory directory;
    const auto path = directory.path / "hub" / "1" / "active_mission_plans.pb";

    ActiveMissionPlans saved;
    saved.update(make_mission_plan(1, command_time, "bot 1"));
    saved.update(make_mission_plan(2, command_time, "bot 2"));
    saved.save(path);

    BOOST_CHECK(!std::filesystem::exists(path.string() + ".tmp"));

    ActiveMissionPlans loaded;
    loaded.update(make_mission_plan(3, command_time, "replaced by load"));
    loaded.load(path);
    BOOST_CHECK(mission_names(loaded) == mission_names(saved));
}

BOOST_AUTO_TEST_CASE(missing_file_loads_no_plans)
{
    TemporaryDirectory directory;
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time, "replaced by load"));
    plans.load(directory.path / "active_mission_plans.pb");
    BOOST_CHECK(plans.to_message().command().empty());
}

BOOST_AUTO_TEST_CASE(unreadable_file_throws_and_loads_no_plans)
{
    TemporaryDirectory directory;
    const auto path = directory.path / "active_mission_plans.pb";
    std::ofstream(path) << "not a protobuf message";

    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time, "replaced by load"));
    BOOST_CHECK_THROW(plans.load(path), std::runtime_error);
    BOOST_CHECK(plans.to_message().command().empty());
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(summary_tests)

std::set<std::uint32_t> bot_ids(const std::vector<Command>& commands)
{
    std::set<std::uint32_t> ids;
    for (const auto& command : commands) ids.insert(command.bot_id());
    return ids;
}

BOOST_AUTO_TEST_CASE(summary_lists_each_bots_command_time)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time, "a"));
    plans.update(make_mission_plan(2, command_time + one_second, "b"));

    const auto summary = plans.summary(3);
    BOOST_CHECK_EQUAL(summary.hub_id(), 3);
    BOOST_REQUIRE_EQUAL(summary.active_mission_size(), 2);
    BOOST_CHECK_EQUAL(summary.active_mission(0).bot_id(), 1);
    BOOST_CHECK_EQUAL(summary.active_mission(0).command_time(), command_time);
    BOOST_CHECK_EQUAL(summary.active_mission(1).bot_id(), 2);
    BOOST_CHECK_EQUAL(summary.active_mission(1).command_time(), command_time + one_second);
}

BOOST_AUTO_TEST_CASE(empty_summary_gets_every_plan)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time, "a"));
    plans.update(make_mission_plan(2, command_time, "b"));

    BOOST_CHECK((bot_ids(plans.newer_than(ActiveMissionPlans().summary(3))) ==
                 std::set<std::uint32_t>{1, 2}));
}

BOOST_AUTO_TEST_CASE(matching_summary_gets_nothing)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time, "a"));

    ActiveMissionPlans other_hub;
    other_hub.update(make_mission_plan(1, command_time + one_second / 4, "a"));

    BOOST_CHECK(plans.newer_than(other_hub.summary(3)).empty());
}

BOOST_AUTO_TEST_CASE(summary_gets_only_plans_it_lacks_or_holds_older)
{
    ActiveMissionPlans plans;
    plans.update(make_mission_plan(1, command_time + one_second, "newer here"));
    plans.update(make_mission_plan(2, command_time, "older here"));
    plans.update(make_mission_plan(3, command_time, "only here"));

    ActiveMissionPlans other_hub;
    other_hub.update(make_mission_plan(1, command_time, "older there"));
    other_hub.update(make_mission_plan(2, command_time + one_second, "newer there"));
    other_hub.update(make_mission_plan(4, command_time, "only there"));

    BOOST_CHECK((bot_ids(plans.newer_than(other_hub.summary(3))) == std::set<std::uint32_t>{1, 3}));
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace hub
} // namespace jaiabot

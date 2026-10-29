#define BOOST_TEST_MODULE jaiabot_test_utils_storm_schedule
#include <boost/test/included/unit_test.hpp>

#include "jaiabot/utils/storm_schedule.h"

using namespace std::chrono_literals;
using jaiabot::utils::storm_schedule::Params;
using jaiabot::utils::storm_schedule::plan_sleep;
using std::chrono::microseconds;

namespace
{
const Params params{3h, 30min, 90s, 60s};

// 2026-11-01 15:00:00 UTC
const microseconds drop = 1793545200s;

// a schedule as saved by the previous sleep prep
jaiabot::protobuf::StormSchedule saved(microseconds anchor, microseconds planned_slot,
                                       std::chrono::seconds lead)
{
    jaiabot::protobuf::StormSchedule schedule;
    schedule.set_period_seconds(std::chrono::seconds(params.period).count());
    schedule.set_anchor(anchor.count());
    schedule.set_planned_slot(planned_slot.count());
    schedule.set_lead_seconds(lead.count());
    return schedule;
}
} // namespace

BOOST_AUTO_TEST_SUITE(StormScheduleSuite)

BOOST_AUTO_TEST_CASE(FirstInWaterAnchorsSchedule)
{
    auto plan = plan_sleep({}, params, drop + 25min, 25min);

    BOOST_CHECK(plan.new_schedule);
    BOOST_CHECK_EQUAL(plan.schedule.anchor(), drop.count());
    BOOST_CHECK_EQUAL(plan.schedule.planned_slot(), microseconds(drop + 3h).count());
    BOOST_CHECK_EQUAL(plan.schedule.lead_seconds(), 90);
    BOOST_CHECK_EQUAL(plan.sleep.count(), std::chrono::seconds(3h - 25min - 90s).count());
    BOOST_CHECK(plan.in_water == drop);
    BOOST_CHECK(!plan.slot_error);
}

BOOST_AUTO_TEST_CASE(LateWakeLengthensLeadWithoutMovingSchedule)
{
    // aimed for 18:00:00 but detected water at 18:00:30
    auto plan = plan_sleep(saved(drop, drop + 3h, 90s), params, drop + 3h + 22min, 21min + 30s);

    BOOST_CHECK(!plan.new_schedule);
    BOOST_CHECK_EQUAL(plan.schedule.anchor(), drop.count());
    BOOST_CHECK_EQUAL(plan.schedule.lead_seconds(), 120);
    BOOST_CHECK_EQUAL(plan.slot_error->count(), 30);
    BOOST_CHECK_EQUAL(plan.schedule.planned_slot(), microseconds(drop + 6h).count());
    BOOST_CHECK_EQUAL(plan.sleep.count(), std::chrono::seconds(3h - 22min - 120s).count());
}

BOOST_AUTO_TEST_CASE(EarlyWakeShortensLead)
{
    auto plan = plan_sleep(saved(drop, drop + 3h, 120s), params, drop + 3h + 20min, 20min + 45s);

    BOOST_CHECK_EQUAL(plan.schedule.lead_seconds(), 75);
}

BOOST_AUTO_TEST_CASE(OverrunSkipsToFollowingSlot)
{
    // 2 h 59 min awake: waking for 18:00 is too late, so aim for 21:00
    auto plan = plan_sleep(saved(drop, drop + 3h, 90s), params, drop + 5h + 59min, 2h + 59min);

    BOOST_CHECK(!plan.new_schedule);
    BOOST_CHECK_EQUAL(plan.schedule.planned_slot(), microseconds(drop + 9h).count());
}

BOOST_AUTO_TEST_CASE(FarFromPlannedSlotStartsNewSchedule)
{
    // a test schedule from last week, then the deployment drop
    const microseconds test_anchor = drop - 7 * 24h - 47min;
    auto plan = plan_sleep(saved(test_anchor, test_anchor + 3h, 100s), params, drop + 25min, 25min);

    BOOST_CHECK(plan.new_schedule);
    BOOST_CHECK_EQUAL(plan.schedule.anchor(), drop.count());
    BOOST_CHECK_EQUAL(plan.schedule.lead_seconds(), 100);
}

BOOST_AUTO_TEST_CASE(PeriodChangeStartsNewSchedule)
{
    auto schedule = saved(drop, drop + 3h, 90s);
    schedule.set_period_seconds(std::chrono::seconds(6h).count());
    auto plan = plan_sleep(schedule, params, drop + 3h + 20min, 20min);

    BOOST_CHECK(plan.new_schedule);
}

BOOST_AUTO_TEST_CASE(UnverifiedClockAssumesPlannedSlot)
{
    auto plan = plan_sleep(saved(drop, drop + 3h, 90s), params, std::nullopt, 20min);

    BOOST_CHECK(!plan.new_schedule);
    BOOST_CHECK_EQUAL(plan.schedule.lead_seconds(), 90);
    BOOST_CHECK(!plan.in_water);
    BOOST_CHECK(!plan.slot_error);
    BOOST_CHECK_EQUAL(plan.schedule.planned_slot(), microseconds(drop + 6h).count());
    BOOST_CHECK_EQUAL(plan.sleep.count(), std::chrono::seconds(3h - 20min - 90s).count());
}

BOOST_AUTO_TEST_CASE(UnverifiedClockWithoutScheduleSleepsRelative)
{
    auto plan = plan_sleep({}, params, std::nullopt, 25min);

    BOOST_CHECK(!plan.schedule.has_anchor());
    BOOST_CHECK(!plan.schedule.has_planned_slot());
    BOOST_CHECK_EQUAL(plan.sleep.count(), std::chrono::seconds(3h - 25min - 90s).count());
}

BOOST_AUTO_TEST_SUITE_END()

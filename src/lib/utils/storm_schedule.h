#ifndef JAIABOT_UTILS_STORM_SCHEDULE_H
#define JAIABOT_UTILS_STORM_SCHEDULE_H

#include <algorithm>
#include <chrono>
#include <optional>

#include "jaiabot/messages/storm.pb.h"

namespace jaiabot
{
namespace utils
{
namespace storm_schedule
{
using std::chrono::microseconds;
using std::chrono::seconds;

struct Params
{
    seconds period;
    // a wake whose in-water detection misses the planned slot by more than this starts a new schedule
    seconds match_window;
    seconds default_lead;
    seconds min_sleep;
};

struct Plan
{
    protobuf::StormSchedule schedule;
    seconds sleep;
    bool new_schedule{false};
};

// utc_now: UTC since the epoch, or nullopt if the clock isn't verified against GPS
inline Plan plan_sleep(const protobuf::StormSchedule& saved, const Params& params,
                       std::optional<microseconds> utc_now, microseconds since_in_water)
{
    Plan plan;
    auto& schedule = plan.schedule;
    schedule = saved;
    schedule.set_period_seconds(params.period.count());

    const bool has_slot = saved.has_anchor() && saved.has_planned_slot() &&
                          saved.period_seconds() == params.period.count();
    microseconds lead =
        saved.has_lead_seconds() ? seconds(saved.lead_seconds()) : params.default_lead;

    if (!utc_now)
    {
        if (!has_slot)
        {
            // no trustworthy time to anchor on: aim for one period after this in-water detection
            schedule.clear_anchor();
            schedule.clear_planned_slot();
            schedule.set_lead_seconds(std::chrono::duration_cast<seconds>(lead).count());
            plan.sleep =
                std::max(std::chrono::duration_cast<seconds>(params.period - since_in_water - lead),
                         params.min_sleep);
            return plan;
        }
        // assume this wake's in-water detection landed on the planned slot
        utc_now = microseconds(saved.planned_slot()) + since_in_water;
    }

    const microseconds in_water = *utc_now - since_in_water;
    const microseconds planned_slot(saved.planned_slot());

    if (has_slot && std::chrono::abs(in_water - planned_slot) <= params.match_window)
    {
        lead = std::clamp(lead + (in_water - planned_slot), microseconds(0),
                          microseconds(params.match_window));
    }
    else
    {
        schedule.set_anchor(in_water.count());
        plan.new_schedule = true;
    }

    // first slot that still leaves min_sleep before waking for it
    const microseconds anchor(schedule.anchor());
    const microseconds period(params.period);
    const microseconds earliest = *utc_now + lead + microseconds(params.min_sleep);
    const auto n = (earliest - anchor + period - microseconds(1)) / period;
    const microseconds next_slot = anchor + n * period;

    schedule.set_planned_slot(next_slot.count());
    schedule.set_lead_seconds(std::chrono::duration_cast<seconds>(lead).count());
    plan.sleep = std::chrono::duration_cast<seconds>(next_slot - lead - *utc_now);
    return plan;
}

} // namespace storm_schedule
} // namespace utils
} // namespace jaiabot

#endif

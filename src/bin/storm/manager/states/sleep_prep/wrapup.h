// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
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

#ifdef JAIABOT_STORM_MANAGER_FWD_DECL
struct Wrapup;
#else
struct Wrapup : boost::statechart::state<Wrapup, SleepPrep>,
                Notify<Wrapup, protobuf::SLEEP_PREP__WRAPUP>
{
    using StateBase = boost::statechart::state<Wrapup, SleepPrep>;

    Wrapup(typename StateBase::my_context c) : StateBase(c)
    {
        using std::chrono::duration_cast;
        using std::chrono::microseconds;
        using std::chrono::seconds;
        namespace storm_schedule = ::jaiabot::utils::storm_schedule;

        const storm_schedule::Params params{seconds(this->machine().mission_period_seconds()),
                                            seconds(this->cfg().schedule_match_window_seconds()),
                                            seconds(this->cfg().schedule_default_lead_seconds()),
                                            min_sleep()};

        std::optional<microseconds> utc_now;
        if (this->machine().clock_verified())
            utc_now =
                duration_cast<microseconds>(goby::time::SystemClock::now().time_since_epoch());

        const auto now = goby::time::SteadyClock::now();
        const auto plan = storm_schedule::plan_sleep(
            this->machine().schedule(), params, utc_now,
            duration_cast<microseconds>(now - this->machine().in_water_time()));

        this->machine().schedule() = plan.schedule;
        this->app().save_schedule(plan.schedule);
        wake_at_ = now + plan.sleep;

        auto utc_str = [](std::int64_t micros)
        { return goby::time::str(goby::time::MicroTime::from_value(micros)); };
        goby::glog.is_verbose() &&
            goby::glog << group("statechart") << "Schedule: " << (plan.new_schedule ? "new, " : "")
                       << (utc_now ? "clock verified" : "clock unverified") << ", anchor "
                       << (plan.schedule.has_anchor() ? utc_str(plan.schedule.anchor()) : "none")
                       << ", next slot "
                       << (plan.schedule.has_planned_slot() ? utc_str(plan.schedule.planned_slot())
                                                            : "none")
                       << ", lead " << plan.schedule.lead_seconds() << " s, sleep "
                       << plan.sleep.count() << " s" << std::endl;
    }
    ~Wrapup() {}

    void loop(const EvLoop& ev)
    {
        auto now = goby::time::SteadyClock::now();

        if (now >= next_mcu_send_time_)
        {
            try_send_to_mcu();
            next_mcu_send_time_ = now + this->machine().mcu_send_interval();
        }
    }

    void try_send_to_mcu()
    {
        // Actually putting the vehicle to sleep is the power board's job: it enters STOP2
        // mode and cuts power to the Raspberry Pi for the requested duration. This is a
        // different device/protocol than the STORM payload MCU (StormMCURequest) used
        // elsewhere in this app, so publish directly to the power board driver instead.
        protobuf::PowerBoardRequest request;
        request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        request.mutable_low_power_request()->set_duration_seconds(sleep_for().count());

        // The power board cuts power to the Pi as soon as it accepts this request, and the
        // log filesystem only commits dirty data every ~30 s, so without a sync the last
        // ~30-60 s of every app's logs (including this state's entry) is lost on each sleep.
        goby::glog.is_verbose() &&
            goby::glog << group("statechart") << "Syncing filesystems before requesting "
                       << request.low_power_request().duration_seconds() << " s sleep" << std::endl;
        ::sync();

        this->interprocess().template publish<::jaiabot::groups::power_board_command>(request);
    }

    static constexpr std::chrono::seconds min_sleep() { return std::chrono::seconds(60); }

    // the power board may take a few tries to accept, so request what's left of the planned sleep
    std::chrono::seconds sleep_for() const
    {
        return std::max(std::chrono::duration_cast<std::chrono::seconds>(
                            wake_at_ - goby::time::SteadyClock::now()),
                        min_sleep());
    }

    void power_board_response(const EvPowerBoardResponse& ev)
    {
        if (ev.resp.status_code() == protobuf::POWER_BOARD_LOW_POWER_ACK)
            post_event(EvSleepReady());
    }

    using reactions =
        boost::mpl::list<boost::statechart::termination<EvSleepReady>,
                         boost::statechart::in_state_reaction<EvPowerBoardResponse, Wrapup,
                                                              &Wrapup::power_board_response>,
                         boost::statechart::in_state_reaction<EvLoop, Wrapup, &Wrapup::loop>>;

  private:
    goby::time::SteadyClock::time_point next_mcu_send_time_{goby::time::SteadyClock::now()};
    goby::time::SteadyClock::time_point wake_at_;
};
#endif

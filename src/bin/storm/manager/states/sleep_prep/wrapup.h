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

    Wrapup(typename StateBase::my_context c) : StateBase(c) {}
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
        protobuf::StormMCURequest request;
        request.set_type(protobuf::StormMCURequest::SLEEP_REQUEST);
        request.set_sleep_for_minutes_with_units(
            this->machine().mission().sleep_for_minutes_with_units());
        this->app().send_to_mcu(request);
    }

    void mcu_response(const EvMCUResponse& ev)
    {
        if (ev.resp.sleep_initiated())
            post_event(EvSleepReady());
    }

    using reactions = boost::mpl::list<
        boost::statechart::termination<EvSleepReady>,
        boost::statechart::in_state_reaction<EvMCUResponse, Wrapup, &Wrapup::mcu_response>,
        boost::statechart::in_state_reaction<EvLoop, Wrapup, &Wrapup::loop>>;

  private:
    goby::time::SteadyClock::time_point next_mcu_send_time_{goby::time::SteadyClock::now()};
};
#endif

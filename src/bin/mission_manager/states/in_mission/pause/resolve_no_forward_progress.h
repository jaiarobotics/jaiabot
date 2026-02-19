// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct ResolveNoForwardProgress;
#else
struct ResolveNoForwardProgress
    : boost::statechart::state<ResolveNoForwardProgress, Pause>,
      Notify<ResolveNoForwardProgress, protobuf::IN_MISSION__PAUSE__RESOLVE_NO_FORWARD_PROGRESS,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<ResolveNoForwardProgress, Pause>;

    ResolveNoForwardProgress(typename StateBase::my_context c)
        : StateBase(c)
    {
        goby::time::SteadyClock::time_point resolve_start = goby::time::SteadyClock::now();
        auto resume_duration = goby::time::convert_duration<goby::time::SteadyClock::duration>(
            cfg().resolve_no_forward_progress().resume_timeout_with_units());
        resume_timeout_ = resolve_start + resume_duration;
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

        // for now, simply wait a period of time and then resume
        if (now >= resume_timeout_)
        {
            post_event(EvForwardProgressResolved());
        }
    }

    ~ResolveNoForwardProgress()
    {
        this->machine().erase_warning(WARNING__VEHICLE__NO_FORWARD_PROGRESS);
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvForwardProgressResolved,
                                      boost::statechart::deep_history<underway::Abort // default
                                                                      >>,
        boost::statechart::in_state_reaction<EvLoop, ResolveNoForwardProgress,
                                             &ResolveNoForwardProgress::loop>>;

  private:
    goby::time::SteadyClock::time_point resume_timeout_;
};
#endif

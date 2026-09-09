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
struct StartingUp;
#else
struct StartingUp : boost::statechart::state<StartingUp, PreDeployment>,
                    Notify<StartingUp, protobuf::PRE_DEPLOYMENT__STARTING_UP>
{
    using StateBase = boost::statechart::state<StartingUp, PreDeployment>;
    StartingUp(typename StateBase::my_context c)
    : StateBase(c)
    {
        goby::time::SteadyClock::time_point timeout_start = goby::time::SteadyClock::now();

        int timeout_seconds = cfg().startup_timeout_with_units<goby::time::SITime>().value();
        goby::time::SteadyClock::duration timeout_duration = std::chrono::seconds(timeout_seconds);
        timeout_stop_ = timeout_start + timeout_duration;

        // update which files are excluded from data offload
        switch (cfg().data_offload_exclude())
        {
            case config::MissionManager::GOBY:
                this->machine().set_data_offload_exclude(" '*.goby'");
                break;
            case config::MissionManager::TASKPACKET:
                this->machine().set_data_offload_exclude(" '*.taskpacket'");
                break;
            case config::MissionManager::NONE: this->machine().set_data_offload_exclude(""); break;
            default: this->machine().set_data_offload_exclude(""); break;
        }
    }

    ~StartingUp() {}

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= timeout_stop_)
            post_event(EvStartupTimeout());
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvStarted, Idle>,
        boost::statechart::transition<EvStartupTimeout, Failed>,
        boost::statechart::in_state_reaction<EvLoop, StartingUp, &StartingUp::loop>>;

  private:
    goby::time::SteadyClock::time_point timeout_stop_;
};
#endif

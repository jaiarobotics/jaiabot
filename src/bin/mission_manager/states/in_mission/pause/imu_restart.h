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
struct IMURestart;
#else
struct IMURestart
    : boost::statechart::state<IMURestart, Pause>,
      Notify<IMURestart, protobuf::IN_MISSION__PAUSE__IMU_RESTART, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<IMURestart, Pause>;

    IMURestart(typename StateBase::my_context c) : StateBase(c)
    {
        goby::time::SteadyClock::time_point imu_restart_start = goby::time::SteadyClock::now();

        // Read in configurable time to stay in IMU Restart State
        int imu_restart_seconds = this->cfg().imu_restart_seconds();
        goby::time::SteadyClock::duration imu_restart_duration =
            std::chrono::seconds(imu_restart_seconds);
        imu_restart_time_stop_ = imu_restart_start + imu_restart_duration;
    }
    ~IMURestart(){};

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= imu_restart_time_stop_)
        {
            this->post_event(EvIMURestartCompleted());
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvIMURestartCompleted,
                                      boost::statechart::deep_history<underway::Abort // default
                                                                      >>,
        boost::statechart::in_state_reaction<EvLoop, IMURestart, &IMURestart::loop>>;

  private:
    goby::time::SteadyClock::time_point imu_restart_time_stop_;
};
#endif

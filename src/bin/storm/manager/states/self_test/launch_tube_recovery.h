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
struct LaunchTubeRecovery;
#else
struct LaunchTubeRecovery : boost::statechart::state<LaunchTubeRecovery, SelfTest>,
                            Notify<LaunchTubeRecovery, protobuf::SELF_TEST__LAUNCH_TUBE_RECOVERY>
{
    using StateBase = boost::statechart::state<LaunchTubeRecovery, SelfTest>;

    LaunchTubeRecovery(typename StateBase::my_context c) : StateBase(c)
    {
        this->machine().mark_launch_tube_recovery_attempted();
        start_next_action();
    }

    // Send 0 command to motor on exit
    ~LaunchTubeRecovery() { send_motor_command(0, 0); }

    void loop(const EvLoop&)
    {
        if (goby::time::SteadyClock::now() < action_end_time_)
            return;

        send_motor_command(0, 0);
        start_next_action();
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvLaunchTubeRecoveryComplete, LaunchTubeDetection>,
        boost::statechart::in_state_reaction<EvLoop, LaunchTubeRecovery, &LaunchTubeRecovery::loop>>;

  private:
    void start_next_action()
    {
        const auto& actions = this->machine().mission().launch_tube().recovery_action();

        if (action_index_ == actions.size())
        {
            post_event(EvLaunchTubeRecoveryComplete());
            return;
        }

        const auto& action = actions.Get(action_index_);
        if (action_repeat_ == action.count())
        {
            ++action_index_;
            action_repeat_ = 0;
            start_next_action();
            return;
        }

        ++action_repeat_;
        const auto duration = action.thrust_duration_with_units<goby::time::SITime>();
        const auto action_duration =
            goby::time::convert_duration<goby::time::SteadyClock::duration>(duration);
        send_motor_command(action.thrust_percentage(), static_cast<int>(duration.value()) + 1);
        action_end_time_ = goby::time::SteadyClock::now() + action_duration;
    }

    void send_motor_command(int thrust_percentage, int timeout_seconds)
    {
        protobuf::LowControl command;
        command.set_id(command_id_++);
        command.set_vehicle(this->cfg().bot_id());
        command.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

        auto* control_surfaces = command.mutable_control_surfaces();
        control_surfaces->set_motor(thrust_percentage);
        control_surfaces->set_port_elevator(0);
        control_surfaces->set_stbd_elevator(0);
        control_surfaces->set_rudder(0);
        control_surfaces->set_timeout(timeout_seconds);
        control_surfaces->set_led_switch_on(true);

        this->interprocess().publish<::jaiabot::groups::low_control>(command);
    }

    int action_index_{0};
    int action_repeat_{0};
    uint32_t command_id_{0};
    goby::time::SteadyClock::time_point action_end_time_{goby::time::SteadyClock::now()};
};
#endif

// Copyright 2026:
//   JaiaRobotics LLC
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
struct CheckMotorTemperature;
#else
// The motor thermistor is unreadable while the motor runs, so stop, let the reading
// settle, and stay stopped while the motor is too hot.
struct CheckMotorTemperature
    : boost::statechart::state<CheckMotorTemperature, Pause>,
      Notify<CheckMotorTemperature, protobuf::IN_MISSION__PAUSE__CHECK_MOTOR_TEMPERATURE,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<CheckMotorTemperature, Pause>;

    CheckMotorTemperature(typename StateBase::my_context c) : StateBase(c)
    {
        settled_time_ =
            goby::time::SteadyClock::now() +
            std::chrono::seconds(this->machine().motor_temperature_check().pause_duration());
        this->machine().clear_motor_temperature_samples();
    }

    void loop(const EvLoop&)
    {
        if (goby::time::SteadyClock::now() < settled_time_)
            return;

        auto temperature = this->machine().mean_motor_temperature();
        if (!temperature)
        {
            goby::glog.is_warn() && goby::glog << "No motor temperature readings, resuming"
                                               << std::endl;
            post_event(EvMotorTemperatureChecked());
            return;
        }

        const auto& check = this->machine().motor_temperature_check();
        if (!has_reading_)
        {
            has_reading_ = true;
            this->machine().add_motor_temperature_result(*temperature);
            holding_ = *temperature >= check.hot_temperature();
            goby::glog.is_debug1() && goby::glog << "Motor temperature: " << *temperature << " C"
                                                 << (holding_ ? ", holding until it cools" : "")
                                                 << std::endl;
        }
        else
        {
            this->machine().update_latest_motor_temperature_result(*temperature);
        }

        if (!holding_ || *temperature <= check.resume_temperature())
            post_event(EvMotorTemperatureChecked());
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvMotorTemperatureChecked,
                                      boost::statechart::deep_history<underway::Abort // default
                                                                      >>,
        boost::statechart::in_state_reaction<EvLoop, CheckMotorTemperature,
                                             &CheckMotorTemperature::loop>>;

  private:
    goby::time::SteadyClock::time_point settled_time_;
    bool has_reading_{false};
    bool holding_{false};
};
#endif

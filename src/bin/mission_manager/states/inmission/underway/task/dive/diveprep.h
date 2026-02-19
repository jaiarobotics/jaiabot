// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
//   Matthew Ferro <matt.ferro@jaia.tech>
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
struct DivePrep;
#else
struct DivePrep : boost::statechart::state<DivePrep, Dive>,
                  Notify<DivePrep, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP,
                         protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<DivePrep, Dive>;

    DivePrep(typename StateBase::my_context c)
        : StateBase(c)
    {
        goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

        // duration granularity is seconds
        int dive_prep_timeout_seconds = cfg().dive_prep_timeout();

        goby::time::SteadyClock::duration dive_prep_duration =
            std::chrono::seconds(dive_prep_timeout_seconds);

        dive_prep_timeout_ = start_timeout + dive_prep_duration;

        if (cfg().camera_available() && cfg().has_start_camera_command())
        {
            auto start_camera_command = cfg().start_camera_command();
            time_t timestamp;
            time(&timestamp);
            start_camera_command.set_datetime(ctime(&timestamp));
            glog.is_debug1() && glog << "Setting datetime: " << start_camera_command.datetime() << std::endl;
            interprocess().publish<jaiabot::groups::camera>(start_camera_command);
        }

        loop(EvLoop());
    }

    ~DivePrep()
    {
        if (machine().gps_tpv().has_location())
        {
            const auto& pos = machine().gps_tpv().location();
            auto& start = *context<Dive>().dive_packet().mutable_start_location();
            start.set_lat_with_units(pos.lat_with_units());
            start.set_lon_with_units(pos.lon_with_units());
        }

        // This makes sure we capture the pressure before the dive begins
        // Then we can adjust pressure accordingly
        this->machine().set_start_of_dive_pressure(this->machine().current_pressure());

        // Calculate and set the depth of our pressure sensor at the start of our dive according to the vehicle's pitch and waterline
        this->machine().calculate_start_of_dive_depth(this->machine().latest_pitch());

        glog.is_debug1() &&
            glog << "Start of Dive Pitch: " << this->machine().latest_pitch().value() << " degrees"
                 << std::endl;
        glog.is_debug1() && glog << "Start of Dive Depth: " << this->machine().start_of_dive_depth()
                                 << " meters" << std::endl;
    }

    void loop(const EvLoop&)
    {
        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

        goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

        if (current_clock >= dive_prep_timeout_)
        {
            glog.is_debug2() && glog << "DivePrep completed" << std::endl;
            post_event(EvDivePrepComplete());
        }
        else
        {
            glog.is_debug2() && glog << "Waiting for DivePrep to be completed" << std::endl;
        }
    }

    void motor_stopped(const EvMotorStopped& ev)
    {
        if (ev.is_motor_stopped) 
        {
            glog.is_debug2() && glog << "DivePrep::motor_stopped Motor is stopped!"
                                    << "\npost_event(EvDivePrepComplete());" << std::endl;
            post_event(EvDivePrepComplete());
        }
    }


    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, DivePrep, &DivePrep::loop>,
        boost::statechart::transition<EvDivePrepComplete, PoweredDescent>,
        boost::statechart::in_state_reaction<EvMotorStopped, DivePrep, &DivePrep::motor_stopped>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime duration_{0 * boost::units::si::seconds};
    // determines when to transition into powered descent
    goby::time::SteadyClock::time_point dive_prep_timeout_;
    // keep check of current bot angle for pitch
    int pitch_angle_check_incr_{0};
    goby::time::MicroTime last_pitch_dive_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
};
#endif

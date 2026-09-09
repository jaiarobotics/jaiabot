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
struct PoweredAscent;
#else
struct PoweredAscent
    : boost::statechart::state<PoweredAscent, Dive>,
      Notify<PoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT,
             protobuf::SETPOINT_POWERED_ASCENT>
{
    using StateBase = boost::statechart::state<PoweredAscent, Dive>;

    // Task::Dive::PoweredAscent
    PoweredAscent(typename StateBase::my_context c)
        : StateBase(c)
    {
        goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

        powered_ascent_motor_on_timeout_ = start_timeout + powered_ascent_motor_on_duration_;

        powered_ascent_motor_off_timeout_ = start_timeout + powered_ascent_motor_off_duration_;

        loop(EvLoop());
    }

    // Task::Dive::PoweredAscent
    ~PoweredAscent()
    {
        goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
        quantity<si::time> dt(end_time - start_time_);
        quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
        quantity<si::velocity> vz = dz / dt;
        double rise_rate = vz.value();

        if (context<Dive>().dive_packet().has_powered_rise_rate())
        {
            rise_rate = (context<Dive>().dive_packet().powered_rise_rate() + vz.value()) / 2;
        }

        context<Dive>().dive_packet().set_powered_rise_rate_with_units(rise_rate *
                                                                    boost::units::si::velocity());
        if( !context<Dive>().has_bot_performed_powered_ascent_after_bottom()) context<Dive>().set_bot_performed_powered_ascent_after_bottom(true);
    }

    void loop(const EvLoop&)
    {
        protobuf::DesiredSetpoints setpoint_msg;
        goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

        // ***************************************************
        // this logic turns the motor off and on
        // while in powered ascent to help assist the vehicle
        // to get out of muddy bottoms
        // ***************************************************

        // we have timedout on motor on
        // and we are not currently in motor off,
        // turn off motor
        if (current_clock >= powered_ascent_motor_on_timeout_ && !in_motor_off_mode_)
        {
            glog.is_debug1() && glog << "Powered Ascent: Turn off motor, we have timed out on motor on!"
                                    << std::endl;

            // Check to see if the duration for motor on is still under max
            if (powered_ascent_motor_on_duration_ < std::chrono::seconds(cfg().motor_on_time_max()))
            {
                // Increment motor on duration
                powered_ascent_motor_on_duration_ +=
                    std::chrono::seconds(cfg().motor_on_time_increment());
            }

            if (powered_ascent_throttle_ < cfg().powered_ascent_throttle_max())
            {
                // Increase powered ascent throttle
                powered_ascent_throttle_ += cfg().powered_ascent_throttle_increment();
            }

            glog.is_debug1() &&
                glog << "PoweredAscent::depth Duration: " << powered_ascent_motor_on_duration_.count()
                    << "\n"
                    << "PoweredAscent::depth Throttle: " << powered_ascent_throttle_ << "\n"
                    << std::endl;

            powered_ascent_motor_off_timeout_ = current_clock + powered_ascent_motor_off_duration_;
            in_motor_off_mode_ = true;
            setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        }
        // we have not timedout on motor on
        else if (current_clock < powered_ascent_motor_on_timeout_)
        {
            glog.is_debug1() && glog << "Powered Ascent: Leave motor running, we have not timed out!"
                                    << std::endl;
            setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
            setpoint_msg.set_throttle(powered_ascent_throttle_);
        }
        // we have timedout on motor off,
        // turn on motor
        else if (current_clock >= powered_ascent_motor_off_timeout_)
        {
            glog.is_debug1() && glog << "Powered Ascent: Turn on motor, we have timed out on motor off!"
                                    << std::endl;
            powered_ascent_motor_on_timeout_ = current_clock + powered_ascent_motor_on_duration_;
            in_motor_off_mode_ = false;
            setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
            setpoint_msg.set_throttle(powered_ascent_throttle_);
        }
        // we have not timedout on motor off
        else if (current_clock < powered_ascent_motor_off_timeout_)
        {
            glog.is_debug1() && glog << "Powered Ascent: Leave motor off, we have not timed out!"
                                    << std::endl;
            setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        }

        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }

    void depth(
        const EvVehicleDepth& ev)
    {
        glog.is_debug1() &&
            glog << "Entered "
                    "jaiabot::statechart::in_mission::underway::task::dive::PoweredAscent::depth: \n"
                << std::endl;

        // keep track of dive information
        DivePoweredAscentDebug dive_pascent_debug;

        // Set Current Depth
        context<Dive>().set_current_depth(ev.depth);

        auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

        glog.is_debug1() && glog << "if (ev.depth < cfg().dive_surface_eps_with_units()): "
                                << (ev.depth < cfg().dive_surface_eps_with_units())
                                << "\n ev.depth: " << ev.depth.value()
                                << "\n cfg().dive_surface_eps(): " << cfg().dive_surface_eps() << "\n"
                                << std::endl;

        // within surface eps of the surface (or any negative value)
        if (ev.depth < cfg().dive_surface_eps_with_units())
        {
            post_event(EvSurfaced());
            dive_pascent_debug.set_surfaced(true);
        }

        // if we've moved eps meters in depth, reset the timer for determining if we
        // are stuck underwater
        // Also make sure we are moving towards surface
        glog.is_warn() && glog << "PoweredAscent::depth ev.depth: " << ev.depth.value() << "\n last_depth_: " << last_depth_.value() << std::endl;
        if (std::abs((ev.depth - last_depth_).value()) > cfg().dive_depth_eps() &&
            (ev.depth < last_depth_))
        {
            glog.is_debug1() && glog << "PoweredAscent::depth we are changing depth!"
                                    << "\n"
                                    << std::endl;
            last_depth_change_time_ = now;
            last_depth_ = ev.depth;
            post_event(EvDiveRising());
        }

        // assume we are stuck if the depth isn't changing for bot not rising timeout seconds
        if ((now - last_depth_change_time_) >
            static_cast<decltype(now)>(cfg().bot_not_rising_timeout_with_units()))
        {
            glog.is_debug1() &&
                glog << "PoweredAscent::depth we are not changing depth! We might be stuck!"
                    << "\n"
                    << std::endl;
        }

        dive_pascent_debug.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
        dive_pascent_debug.set_current_depth(ev.depth.value());
        interprocess().publish<jaiabot::groups::mission_dive>(dive_pascent_debug);
        glog.is_debug1() &&
            glog
                << "Exit jaiabot::statechart::in_mission::underway::task::dive::PoweredAscent::depth: \n"
                << std::endl;
    }

    void pitch(
        const EvVehiclePitch& ev)
    {
        auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

        // If we are not vertical then change to reacquire gps state.
        // We are most likey driving on the surface, possible pressure sensor error
        if (std::abs(ev.pitch.value()) <= cfg().pitch_to_determine_powered_ascent_vertical())
        {
            // Check to see if we have reached the number of checks and the min check time
            // has been reach to determine if a bot is no longer vertical
            if ((pitch_angle_check_incr_ >= (cfg().pitch_angle_checks() - 1)) &&
                ((now - last_pitch_dive_time_) >=
                static_cast<decltype(now)>(cfg().pitch_angle_min_check_time_with_units())))
            {
                glog.is_warn() && glog << "PoweredAscent::pitch Bot is no longer vertical!"
                                    << "\npost_event(EvBotNotVertical());" << std::endl;
                post_event(EvBotNotVertical());
            }
            pitch_angle_check_incr_++;
        }
        else
        {
            last_pitch_dive_time_ = now;
            pitch_angle_check_incr_ = 0;
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvSurfaced, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvLoop, PoweredAscent, &PoweredAscent::loop>,
        boost::statechart::transition<EvDiveRising, UnpoweredAscent>,
        boost::statechart::transition<EvBotNotVertical, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvVehicleDepth, PoweredAscent, &PoweredAscent::depth>,
        boost::statechart::in_state_reaction<EvVehiclePitch, PoweredAscent, &PoweredAscent::pitch>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    // determines when to turn on motor during powered ascent
    goby::time::SteadyClock::time_point powered_ascent_motor_on_timeout_;
    // determines when to turn off motor during powered ascent
    goby::time::SteadyClock::time_point powered_ascent_motor_off_timeout_;
    // determines duration to have the motor on
    goby::time::SteadyClock::duration powered_ascent_motor_on_duration_ =
        std::chrono::seconds(cfg().powered_ascent_motor_on_timeout());
    // determines duration to have the motor off
    goby::time::SteadyClock::duration powered_ascent_motor_off_duration_ =
        std::chrono::seconds(cfg().powered_ascent_motor_off_timeout());
    // determines when we are still in motor off mode
    bool in_motor_off_mode_{false};
    // keep track of the depth changes so we can detect if we are stuck
    boost::units::quantity<boost::units::si::length> last_depth_{context<Dive>().current_depth()};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
    double powered_ascent_throttle_{cfg().powered_ascent_throttle()};
    // keep check of current bot angle for pitch
    int pitch_angle_check_incr_{0};
    goby::time::MicroTime last_pitch_dive_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
};
#endif

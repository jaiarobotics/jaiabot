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
struct Hold;
#else
struct Hold
    : boost::statechart::state<Hold, Dive>,
      Notify<Hold, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__HOLD, protobuf::SETPOINT_DIVE>
{
    using StateBase = boost::statechart::state<Hold, Dive>;

    Hold(typename StateBase::my_context c)
        : StateBase(c), measurement_(*context<Dive>().dive_packet().add_measurement())
    {
        goby::time::SteadyClock::time_point hold_start = goby::time::SteadyClock::now();
        // duration granularity is seconds
        int hold_seconds =
            context<Dive>().current_dive().hold_time_with_units<goby::time::SITime>().value();

        goby::time::SteadyClock::duration hold_duration = std::chrono::seconds(hold_seconds);
        hold_stop_ = hold_start + hold_duration;

        // Keep track if the bot has already had a hold
        // We need to adjust our bottom logic timeout
        // If we go back into powered descent
        if (!context<Dive>().has_bot_performed_a_hold())
        {
            context<Dive>().set_bot_performed_a_hold(true);
        }

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
        setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }

    ~Hold()
    {
        // compute stats for DivePacket
        if (!depths_.empty())
        {
            quantity<si::length> d_mean(0 * si::meters);
            for (const auto& d : depths_) d_mean += d;
            d_mean /= static_cast<double>(depths_.size());
            measurement_.set_mean_depth_with_units(d_mean);
        }

        if (!temperatures_.empty())
        {
            double t_mean(0);
            // can't sum absolute temperatures, so strip off the units while we do the mean calculation
            for (const auto& t : temperatures_) t_mean += t.value();

            t_mean /= static_cast<double>(temperatures_.size());
            measurement_.set_mean_temperature_with_units(
                t_mean * boost::units::absolute<boost::units::celsius::temperature>());
        }

        if (!salinities_.empty())
        {
            double s_mean(0);
            for (const auto& s : salinities_) s_mean += s;
            s_mean /= static_cast<double>(salinities_.size());
            measurement_.set_mean_salinity(s_mean);
        }
    }

    void loop(const EvLoop&)
    {
        glog.is_debug1() &&
            glog << "Entered jaiabot::statechart::in_mission::underway::task::dive::Hold::loop: \n"
                << std::endl;

        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

        //Keep track of dive information
        DiveHoldDebug dive_hold_debug;

        dive_hold_debug.set_hold_timeout(hold_stop_.time_since_epoch().count());

        glog.is_debug2() && glog << "if (now >= hold_stop_): " << (now >= hold_stop_)
                                << "\n Current Time: " << now.time_since_epoch().count()
                                << "\n Hold Timeout: " << hold_stop_.time_since_epoch().count() << "\n"
                                << std::endl;

        if (now >= hold_stop_)
        {
            context<Dive>().pop_goal_depth();
            if (context<Dive>().dive_complete())
            {
                glog.is_debug2() && glog << "context<Dive>().dive_complete() == true"
                                        << "\n post_event(EvDiveComplete())" << std::endl;
                post_event(EvDiveComplete());
                dive_hold_debug.set_dive_complete(true);
            }
            else
            {
                glog.is_debug2() && glog << "context<Dive>().dive_complete() == false"
                                        << "\n post_event(EvHoldComplete())" << std::endl;
                post_event(EvHoldComplete());
                dive_hold_debug.set_hold_complete(true);
            }
        }
        interprocess().publish<jaiabot::groups::mission_dive>(dive_hold_debug);
        glog.is_debug1() &&
            glog << "Exit jaiabot::statechart::in_mission::underway::task::dive::Hold::loop: \n"
                << std::endl;
    }

    void measurement(
        const EvMeasurement& ev)
    {
        if (ev.temperature)
            temperatures_.push_back(ev.temperature.get());
        if (ev.salinity)
            salinities_.push_back(ev.salinity.get());
    }

    void depth(const EvVehicleDepth& ev)
    {
        glog.is_debug1() &&
            glog << "Entered jaiabot::statechart::in_mission::underway::task::dive::Hold::depth: \n"
                << std::endl;

        //Keep track of dive information
        DiveHoldDebug dive_hold_debug;

        // Set Current Depth
        context<Dive>().set_current_depth(ev.depth);

        glog.is_debug2() &&
            glog << "if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units()): "
                << (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
                << "\n ev.depth: " << ev.depth.value()
                << "\n context<Dive>().dive_packet().depth_achieved_with_units(): "
                << context<Dive>().dive_packet().depth_achieved_with_units().value() << "\n"
                << std::endl;
        if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
        {
            context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);
        }

        depths_.push_back(ev.depth);

        dive_hold_debug.set_current_depth(ev.depth.value());
        interprocess().publish<jaiabot::groups::mission_dive>(dive_hold_debug);

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
        setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

        glog.is_debug1() &&
            glog << "Exit jaiabot::statechart::in_mission::underway::task::dive::Hold::depth: \n"
                << std::endl;
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvHoldComplete, PoweredDescent>,
        boost::statechart::in_state_reaction<EvLoop, Hold, &Hold::loop>,
        boost::statechart::in_state_reaction<EvMeasurement, Hold, &Hold::measurement>,
        boost::statechart::in_state_reaction<EvVehicleDepth, Hold, &Hold::depth>,
        boost::statechart::transition<EvDiveComplete, UnpoweredAscent>>;

  private:
    goby::time::SteadyClock::time_point hold_stop_;
    jaiabot::protobuf::DivePacket::Measurements& measurement_;

    std::vector<boost::units::quantity<boost::units::si::length>> depths_;
    std::vector<boost::units::quantity<boost::units::absolute<boost::units::celsius::temperature>>>
        temperatures_;
    std::vector<double> salinities_;
};
#endif

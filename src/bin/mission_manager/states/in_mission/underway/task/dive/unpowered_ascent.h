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
struct UnpoweredAscent;
#else
struct UnpoweredAscent
    : boost::statechart::state<UnpoweredAscent, Dive>,
      Notify<UnpoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<UnpoweredAscent, Dive>;

    const int CTDUpdateRate = 100000; // 0.1 seconds

    // Task::Dive::UnpoweredAscent
    UnpoweredAscent(
        typename StateBase::my_context c)
        : StateBase(c)
    {
        latest_ctd_snapshot_.set_depth(context<Dive>().current_depth().value());

        if (cfg().camera_available() && cfg().has_stop_camera_command())
        {
            interprocess().publish<jaiabot::groups::camera>(cfg().stop_camera_command());
        }
        
        loop(EvLoop());
    }

    ~UnpoweredAscent()
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

        context<Dive>().dive_packet().set_unpowered_rise_rate_with_units(rise_rate *
                                                                        boost::units::si::velocity());

        latest_ctd_profile_.set_bot_id(cfg().bot_id());
        latest_ctd_profile_.mutable_location()->set_lat(this->machine().gps_tpv().location().lat());
        latest_ctd_profile_.mutable_location()->set_lon(this->machine().gps_tpv().location().lon());
        interprocess().publish<jaiabot::groups::ctd>(latest_ctd_profile_);
        latest_ctd_profile_.clear_snapshot();
        glog.is_debug1() && glog << "Published CTD profile" << std::endl; 
    }

    void loop(const EvLoop&)
    {
        glog.is_debug1() &&
            glog << "Entered "
                    "jaiabot::statechart::in_mission::underway::task::dive::UnpoweredAscent::loop: \n"
                << std::endl;

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }

    void depth(
        const EvVehicleDepth& ev)
    {
        glog.is_debug1() &&
            glog << "Entered "
                    "jaiabot::statechart::in_mission::underway::task::dive::UnpoweredAscent::depth: \n"
                << std::endl;

        //Keep track of dive information
        DiveUnpoweredAscentDebug dive_uascent_debug;

        // Set Current Depth
        context<Dive>().set_current_depth(ev.depth);

        auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

        glog.is_debug1() &&
            glog << "if (ev.depth < cfg().dive_surface_eps_with_units()): "
                << (ev.depth < cfg().dive_surface_eps_with_units())
                << "\n ev.depth: " << ev.depth.value() << "\n last_depth_: " << last_depth_.value()
                << "\n is current depth less than last_depth: " << (ev.depth < last_depth_)
                << "\n is the current depth - last_depth: " << (ev.depth - last_depth_).value()
                << "\n is it greater than eps: "
                << (std::abs((ev.depth - last_depth_).value()) > cfg().dive_depth_eps())
                << "\n is the current depth lest than the last: " << (ev.depth < last_depth_)
                << "\n cfg().dive_surface_eps: " << cfg().dive_depth_eps() << "\n"
                << std::endl;

        // Nose of the bot is within surface eps of the surface (or any negative value)
        if ((ev.sensor_depth.value() - cfg().pressure_sensor_to_waterline()) < cfg().dive_surface_eps())
        {
            post_event(EvSurfaced());
            dive_uascent_debug.set_surfaced(true);
        }

        // if we've moved eps meters in depth, reset the timer for determining if we
        // are stuck underwater
        // Also make sure we are moving towards surface
        if (std::abs((ev.depth - last_depth_).value()) > cfg().dive_depth_eps() &&
            (ev.depth < last_depth_))
        {
            last_depth_change_time_ = now;
            last_depth_ = ev.depth;
        }

        // assume we are stuck if the depth isn't changing
        if ((now - last_depth_change_time_) >
            static_cast<decltype(now)>(cfg().bot_not_rising_timeout_with_units()))
        {
            glog.is_debug1() &&
                glog << "UnpoweredAscent::depth we are not changing depth! We might be stuck!"
                    << "\n"
                    << std::endl;

            post_event(EvSurfacingTimeout());
        }

        dive_uascent_debug.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
        dive_uascent_debug.set_current_depth(ev.depth.value());
        interprocess().publish<jaiabot::groups::mission_dive>(dive_uascent_debug);
        glog.is_debug1() &&
            glog << "Exit "
                    "jaiabot::statechart::in_mission::underway::task::dive::UnpoweredAscent::depth: \n"
                << std::endl;
    }

    void collectCTD(const EvMeasurement& ev)
    {
        auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

        if (ev.salinity.has_value()) {
            latest_ctd_snapshot_.set_salinity(ev.salinity.value());
        }

        if (ev.temperature.has_value()) {
            latest_ctd_snapshot_.set_temperature(ev.temperature->value());
        }

        if (ev.sensor_depth.has_value()) {
            latest_ctd_snapshot_.set_depth(ev.sensor_depth->value());
        }

        if (now.value() - last_snapshot_time_.value() >= CTDUpdateRate) {
            glog.is_debug1() && glog << "Adding CTD snapshot to profile" << std::endl;
            latest_ctd_snapshot_.set_time(now.value());
            latest_ctd_profile_.add_snapshot()->CopyFrom(latest_ctd_snapshot_);
            last_snapshot_time_ = now;
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvSurfacingTimeout, PoweredAscent>,
        boost::statechart::transition<EvSurfaced, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvLoop, UnpoweredAscent, &UnpoweredAscent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, UnpoweredAscent,
                                             &UnpoweredAscent::depth>,
        boost::statechart::in_state_reaction<EvMeasurement, UnpoweredAscent, &UnpoweredAscent::collectCTD>>;

  private:
    goby::time::MicroTime detect_depth_changes_init_timeout_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};

    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    // keep track of the depth changes so we can detect if we are stuck
    boost::units::quantity<boost::units::si::length> last_depth_{context<Dive>().current_depth()};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime last_snapshot_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    jaiabot::protobuf::CTDSnapshot latest_ctd_snapshot_;
    jaiabot::protobuf::CTDProfile latest_ctd_profile_;
};
#endif

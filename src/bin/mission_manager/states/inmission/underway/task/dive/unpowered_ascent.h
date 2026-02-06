struct UnpoweredAscent
    : boost::statechart::state<UnpoweredAscent, Dive>,
      Notify<UnpoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<UnpoweredAscent, Dive>;

    // Task::Dive::UnpoweredAscent
    UnpoweredAscent(
        typename StateBase::my_context c)
        : StateBase(c)
    {
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
    }

    void loop(const EvLoop&)
    {
        glog.is_debug1() &&
            glog << "Entered "
                    "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::loop: \n"
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
                    "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth: \n"
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
                    "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth: \n"
                << std::endl;
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvSurfacingTimeout, PoweredAscent>,
        boost::statechart::transition<EvSurfaced, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvLoop, UnpoweredAscent, &UnpoweredAscent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, UnpoweredAscent,
                                             &UnpoweredAscent::depth>>;

  private:
    goby::time::MicroTime detect_depth_changes_init_timeout_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};

    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    // keep track of the depth changes so we can detect if we are stuck
    boost::units::quantity<boost::units::si::length> last_depth_{context<Dive>().current_depth()};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
};

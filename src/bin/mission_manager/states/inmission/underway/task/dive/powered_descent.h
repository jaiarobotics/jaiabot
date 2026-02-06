struct PoweredDescent
    : boost::statechart::state<PoweredDescent, Dive>,
      Notify<PoweredDescent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT,
             protobuf::SETPOINT_DIVE>
{
    using StateBase = boost::statechart::state<PoweredDescent, Dive>;

    PoweredDescent(
        typename StateBase::my_context c)
        : StateBase(c)
    {
        // This makes sure we capture the pressure before the dive begins
        // Then we can adjust pressure accordingly
        this->machine().set_start_of_dive_pressure(this->machine().current_pressure());

        // Calculate and set the depth of our pressure sensor at the start of our dive according to the vehicle's pitch and waterline 
        this->machine().calculate_start_of_dive_depth(this->machine().latest_pitch()); 

        glog.is_debug1() && glog << "Start of Dive Pitch: " << this->machine().latest_pitch().value() << " degrees" <<std::endl;
        glog.is_debug1() && glog << "Start of Dive Depth: " << this->machine().start_of_dive_depth() << " meters" <<std::endl;

        // Start the timeout for detecting the bottom
        goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();
        // duration granularity is seconds
        int detect_bottom_logic_timeout_seconds = cfg().detect_bottom_logic_init_timeout();

        // Keep track if the bot has already had a hold
        // We need to adjust our bottom logic timeout
        if (context<Dive>().has_bot_performed_a_hold())
        {
            detect_bottom_logic_timeout_seconds = cfg().detect_bottom_logic_after_hold_timeout();
        }

        // duration granularity is seconds
        int powered_descent_timeout_seconds = cfg().powered_descent_timeout();

        goby::time::SteadyClock::duration detect_bottom_logic_duration =
            std::chrono::seconds(detect_bottom_logic_timeout_seconds);

        goby::time::SteadyClock::duration powered_descent_timeout_duration =
            std::chrono::seconds(powered_descent_timeout_seconds);

        detect_bottom_logic_timeout_ = start_timeout + detect_bottom_logic_duration;

        powered_descent_timeout_ = start_timeout + powered_descent_timeout_duration;
    }

    ~PoweredDescent()
    {
        goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
        goby::time::MicroTime dt(end_time - start_time_ - duration_correction_);
        context<Dive>().add_to_dive_duration(dt);
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

        // Check when to stop logging
        if (current_clock >= powered_descent_timeout_)
        {
            glog.is_debug2() && glog << "Safety Powered Descent Timeout!" << std::endl;
            post_event(EvPowerDescentSafety());
        }
        else
        {
            glog.is_debug2() && glog << "Safety Powered Descent Timeout Not Reached!" << std::endl;
        }
    }

    /**
     * @brief Executes when the bot receives a new depth reading so that the bot can 
     *        determine if it has reached its goal depth 
     * 
     * @param ev Depth event used to pass the new depth reading
     */
    void depth(
        const EvVehicleDepth& ev)
    {
        glog.is_debug1() &&
            glog << "Entered "
                    "jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth: \n"
                << std::endl;

        // Desired setpoint command
        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_DIVE);

        // keep track of dive information
        DivePowerDescentDebug dive_pdescent_debug;

        auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
        goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

        // Set Current Depth
        context<Dive>().set_current_depth(ev.depth);

        // check needed to initially set the last_depth to the current one
        if (is_initial_depth_reading_)
        {
            last_depth_ = ev.depth;
            is_initial_depth_reading_ = false;
        }

        dive_pdescent_debug.set_current_depth(ev.depth.value());
        dive_pdescent_debug.set_goal_depth(context<Dive>().goal_depth().value());
        dive_pdescent_debug.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
        dive_pdescent_debug.set_last_depth(last_depth_.value());
        dive_pdescent_debug.set_last_depth_change_time(last_depth_change_time_.value());
        dive_pdescent_debug.set_bottoming_timeout_with_units(cfg().bottoming_timeout_with_units());

        glog.is_debug1() &&
            glog << "(boost::units::abs(ev.depth - context<Dive>().goal_depth()) < "
                    "cfg().dive_depth_eps_with_units()): "
                << (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
                    cfg().dive_depth_eps_with_units())
                << "\n ev.depth: " << ev.depth.value()
                << "\n context<Dive>().goal_depth(): " << context<Dive>().goal_depth().value()
                << "\n cfg().dive_depth_eps: " << cfg().dive_depth_eps()
                << "\n ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units()): "
                << ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
                << "\n ((ev.depth - last_depth_) > "
                    "cfg().dive_eps_to_determine_diving_with_units()): "
                << ((ev.depth - last_depth_) > cfg().dive_eps_to_determine_diving_with_units())
                << "\n ev.depth: " << ev.depth.value() << "\n last_depth_" << last_depth_.value()
                << "\n cfg().dive_depth_eps: " << cfg().dive_depth_eps()
                << "\n cfg().dive_eps_to_determine_diving: " << cfg().dive_eps_to_determine_diving()
                << "\n Intial Timeout complete: " << (current_clock >= detect_bottom_logic_timeout_)
                << "\n Is bot diving: " << is_bot_diving_
                << "\n (now - last_depth_change_time_) >"
                    "static_cast<decltype(now)>(cfg().bottoming_timeout_with_units())"
                << ((now - last_depth_change_time_) >
                    static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
                << std::endl;

        if (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
            cfg().dive_depth_eps_with_units())
        {
            // Set depth achieved if we have reached our goal depth
            context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);
            dive_pdescent_debug.set_depth_reached(true);
            post_event(EvDepthTargetReached());
        }

        // if we've moved eps meters in depth, then we consider the bot to be diving
        // and check if we already determined the bot is diving
        if ((ev.depth - last_depth_) > cfg().dive_eps_to_determine_diving_with_units() &&
            !is_bot_diving_)
        {
            last_depth_change_time_ = now;
            last_depth_ = ev.depth;
            dive_pdescent_debug.set_bot_is_diving(true);
            is_bot_diving_ = true;
        }

        // Check if our initial timeout has been reached to detect bottom
        // or if the bot is diving.
        if (current_clock >= detect_bottom_logic_timeout_ || is_bot_diving_)
        {
            // if we've moved eps meters in depth, reset the timer for determining hitting the seafloor
            if ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
            {
                last_depth_change_time_ = now;
                last_depth_ = ev.depth;
                dive_pdescent_debug.set_depth_changed(true);
            }

            // assume we've hit the bottom if the depth isn't changing for bottoming timeout seconds
            if ((now - last_depth_change_time_) >
                static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
            {
                context<Dive>().set_seafloor_reached(ev.depth);

                // Set depth achieved if we had a bottoming timeout
                context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);

                // Set the max_acceration
                context<Dive>().dive_packet().set_max_acceleration_with_units(
                    this->machine().latest_max_acceleration());

                //Commenting out max acceperation hard/soft determination for bottom type to switch to ascent-based logic
                // // Determine Hard/Soft
                // if (this->machine().latest_max_acceleration().value() >=
                //     cfg().hard_bottom_type_acceleration())
                // {
                //     // Set the bottom_type Hard
                //     context<Dive>().dive_packet().set_bottom_type(
                //         protobuf::DivePacket::BottomType::DivePacket_BottomType_HARD);
                // }
                // else
                // {
                //     // Set the bottom_type Soft
                //     context<Dive>().dive_packet().set_bottom_type(
                //         protobuf::DivePacket::BottomType::DivePacket_BottomType_SOFT);
                // }

                // used to correct dive rate calculation
                duration_correction_ = (now - last_depth_change_time_);
                post_event(EvDepthTargetReached());
                dive_pdescent_debug.set_depth_change_timeout(true);
            }
        }

        interprocess().publish<jaiabot::groups::mission_dive>(dive_pdescent_debug);

        // If bot is diving
        // or if we are going back into powered descent after a hold at a depth
        // or if we are in sim
        // Then use PID
        if (is_bot_diving_ || context<Dive>().has_bot_performed_a_hold() || cfg().is_sim())
        {
            setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
        }

        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

        glog.is_debug1() &&
            glog << "Exit jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth: "
                    "\n"
                << std::endl;
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvDepthTargetReached, Hold>,
        boost::statechart::in_state_reaction<EvLoop, PoweredDescent, &PoweredDescent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, PoweredDescent,
                                             &PoweredDescent::depth>,
        boost::statechart::transition<EvPowerDescentSafety, UnpoweredAscent>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime duration_correction_{0 * boost::units::si::seconds};

    // keep track of the depth changes so we can detect if we've hit the seafloor
    boost::units::quantity<boost::units::si::length> last_depth_{0};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
    // determines when to start using powered descent logic
    goby::time::SteadyClock::time_point detect_bottom_logic_timeout_;
    // determines when to safely timout of powered descent and transition into unpowered ascent
    goby::time::SteadyClock::time_point powered_descent_timeout_;
    // determines when the bot is diving
    bool is_bot_diving_{false};
    // determines the initial value for last_depth_
    bool is_initial_depth_reading_{true};
};

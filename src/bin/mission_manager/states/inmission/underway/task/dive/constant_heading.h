
struct ConstantHeading
    : boost::statechart::state<ConstantHeading, Dive>,
    Notify<ConstantHeading, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__CONSTANT_HEADING,
            protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<ConstantHeading, Dive>;

    ConstantHeading(
    typename StateBase::my_context c)
    : StateBase(c)
    {
        boost::units::quantity<boost::units::si::plane_angle> heading(
            (this->machine().bottom_depth_safety_constant_heading() * boost::units::degree::degrees));

        boost::units::quantity<boost::units::si::velocity> speed(
            (this->machine().bottom_depth_safety_constant_heading_speed() *
            boost::units::si::meters_per_second));

        IvPBehaviorUpdate constantHeadingUpdate;
        IvPBehaviorUpdate constantSpeedUpdate;

        constantHeadingUpdate = create_constant_heading_update(heading);
        constantSpeedUpdate = create_constant_speed_update(speed);

        this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);

        goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
        int setpoint_seconds = this->machine().bottom_depth_safety_constant_heading_time();
        goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
        setpoint_stop_ = setpoint_start + setpoint_duration;
    }

    ~ConstantHeading()
    {
        IvPBehaviorUpdate constantHeadingUpdate;
        IvPBehaviorUpdate constantSpeedUpdate;
        constantHeadingUpdate.mutable_constantheading()->set_active(false);
        constantSpeedUpdate.mutable_constantspeed()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= setpoint_stop_)
            post_event(EvTaskComplete());
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, ConstantHeading, &ConstantHeading::loop>>;

private:
    goby::time::SteadyClock::time_point setpoint_stop_;
};


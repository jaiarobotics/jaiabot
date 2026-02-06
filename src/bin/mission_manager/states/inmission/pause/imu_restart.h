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

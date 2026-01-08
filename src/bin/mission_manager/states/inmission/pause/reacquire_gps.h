struct ReacquireGPS
    : boost::statechart::state<ReacquireGPS, Pause>,
      Notify<ReacquireGPS, protobuf::IN_MISSION__PAUSE__REACQUIRE_GPS, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<ReacquireGPS, Pause>;


    // Pause::ReacquireGPS
    ReacquireGPS(typename StateBase::my_context c) : StateBase(c)
    {
        if (this->app().is_test_mode(config::MissionManager::ENGINEERING_TEST__INDOOR_MODE__NO_GPS))
        {
            // in indoor mode, simply post that we've received a fix
            // (even though we haven't as there's no GPS)
            post_event(statechart::EvGPSFix());
        }
        else
        {
            this->machine().insert_warning(WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
        }
    }

    ~ReacquireGPS(){};

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().transit_hdop_req()) &&
            (ev.pdop <= this->machine().transit_pdop_req()))
        {
            // Increment gps fix checks until we are > the threshold for confirming gps fix
            if (gps_fix_check_incr_ < (this->machine().transit_gps_fix_checks() - 1))
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a good fix, but has not "
                                  "reached threshold for total checks"
                                  " "
                               << gps_fix_check_incr_ << " < "
                               << (this->machine().transit_gps_fix_checks() - 1) << std::endl;
                // Increment until we reach total gps fix checks
                gps_fix_check_incr_++;
            }
            else
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a good fix, Post EvGPSFix, hdop is " << ev.hdop
                               << " <= " << this->machine().transit_hdop_req() << ", pdop is "
                               << ev.pdop << " <= " << this->machine().transit_pdop_req()
                               << " Reset incr for gps degraded fix" << std::endl;

                // Post Event for gps fix
                this->post_event(statechart::EvGPSFix());
            }
        }
        else
        {
            // Reset gps fix incrementor
            gps_fix_check_incr_ = 0;
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvGPSFix,
                                      boost::statechart::deep_history<underway::Abort // default
                                                                      >>,
        boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPS, &ReacquireGPS::gps>>;

  private:
    int gps_fix_check_incr_{0};
};

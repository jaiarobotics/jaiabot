// Base class for all StationKeep and Transit states to manage ReacquireGPS and IMURestart pause calculations / transitions
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, MissionState state>
struct IvPSensorPauseCommon : boost::statechart::state<Derived, Parent>,
                              Notify<Derived, state, protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    IvPSensorPauseCommon(typename StateBase::my_context c) : StateBase(c)
    {
        this->machine().erase_warning(WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
    }

    ~IvPSensorPauseCommon(){};

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().transit_hdop_req()) &&
            (ev.pdop <= this->machine().transit_pdop_req()))
        {
            // Reset Counter For Degraded Checks
            gps_degraded_fix_check_incr_ = 0;
        }
        else
        {
            // Increment degraded checks until we are > the threshold for confirming degraded gps
            if (gps_degraded_fix_check_incr_ <
                (this->machine().transit_gps_degraded_fix_checks() - 1))
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a degraded fix, but has not "
                                  "reached threshold for total checks: "
                                  " "
                               << gps_degraded_fix_check_incr_ << " < "
                               << (this->machine().transit_gps_degraded_fix_checks() - 1)
                               << std::endl;

                // Increment until we reach total gps degraded fix checks
                gps_degraded_fix_check_incr_++;
            }
            else
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a degraded fix, Post EvGPSNoFix, hdop is " << ev.hdop
                               << " > " << this->machine().transit_hdop_req() << ", pdop is "
                               << ev.pdop << " > " << this->machine().transit_pdop_req()
                               << " Reset incr for gps fix" << std::endl;

                // Post Event for no gps fix
                this->post_event(statechart::EvGPSNoFix());
            }
        }
    }

    using common_reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvVehicleGPS, IvPSensorPauseCommon,
                                                              &IvPSensorPauseCommon::gps>,
                         boost::statechart::transition<EvGPSNoFix, pause::ReacquireGPS>,
                         boost::statechart::transition<EvIMURestart, pause::IMURestart>>;

  private:
    int gps_degraded_fix_check_incr_{0};
};

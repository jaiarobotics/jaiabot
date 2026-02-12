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

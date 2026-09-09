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
struct ReacquireGPS;
#else
struct ReacquireGPS
    : boost::statechart::state<ReacquireGPS, Dive>,
      Notify<ReacquireGPS, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<ReacquireGPS, Dive>;

    // Dive::ReacquireGPS
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

    ~ReacquireGPS()
    {
        end_time_ = goby::time::SystemClock::now<goby::time::MicroTime>();
        context<Dive>().dive_packet().set_duration_to_acquire_gps_with_units(end_time_ - start_time_);
        this->machine().erase_warning(WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
    }

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().after_dive_hdop_req()) &&
            (ev.pdop <= this->machine().after_dive_pdop_req()))
        {
            // Increment gps fix checks until we are > the threshold for confirming gps fix
            if (gps_fix_check_incr_ < (this->machine().after_dive_gps_fix_checks() - 1))
            {
                goby::glog.is_debug1() &&
                    goby::glog << "GPS has a good fix, but has not "
                                  "reached threshold for total checks"
                                  " "
                               << gps_fix_check_incr_ << " < "
                               << (this->machine().after_dive_gps_fix_checks() - 1) << std::endl;
                // Increment until we reach total gps fix checks
                gps_fix_check_incr_++;
            }
            else
            {
                goby::glog.is_debug1() &&
                    goby::glog << "GPS has a good fix, Post EvGPSFix, hdop is " << ev.hdop
                               << " <= " << this->machine().after_dive_hdop_req() << ", pdop is "
                               << ev.pdop << " <= " << this->machine().after_dive_pdop_req()
                               << " Reset incr for gps degraded fix" << std::endl;

                goby::glog.is_debug2() &&
                    goby::glog << "Reached Min depth: "
                               << context<Task>().task_packet().dive().reached_min_depth()
                               << std::endl;

                if (context<Task>().task_packet().dive().reached_min_depth())
                {
                    context<InMission>().resume_after_srp_egress();
                    this->post_event(EvBottomDepthAbort());
                }
                else
                {
                    // Post Event for gps fix
                    this->post_event(statechart::EvGPSFix());
                }
            }
        }
        else
        {
            // Reset gps fix incrementor
            gps_fix_check_incr_ = 0;
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPS, &ReacquireGPS::gps>,
        boost::statechart::transition<EvBottomDepthAbort, ConstantHeading>,
        boost::statechart::transition<EvGPSFix, SurfaceDrift>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()},
        end_time_;
    int gps_fix_check_incr_{0};
};
#endif


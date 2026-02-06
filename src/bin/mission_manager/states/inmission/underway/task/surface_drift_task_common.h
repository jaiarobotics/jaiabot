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

// Base class for all Task SurfaceDrifts as these do nearly the same thing.
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, MissionState state>
struct SurfaceDriftTaskCommon : boost::statechart::state<Derived, Parent>,
                                Notify<Derived, state, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    SurfaceDriftTaskCommon(typename StateBase::my_context c) : StateBase(c)
    {
        goby::time::SteadyClock::time_point drift_time_start = goby::time::SteadyClock::now();

        auto drift_time = this->template context<Task>()
                              .current_task()
                              ->surface_drift()
                              .template drift_time_with_units<goby::time::SITime>();

        drift_packet().set_drift_duration_with_units(drift_time);

        int drift_time_seconds = drift_time.value();
        goby::time::SteadyClock::duration drift_time_duration =
            std::chrono::seconds(drift_time_seconds);
        drift_time_stop_ = drift_time_start + drift_time_duration;

        if (this->machine().gps_tpv().has_location())
        {
            const auto& pos = this->machine().gps_tpv().location();
            auto& start = *drift_packet().mutable_start_location();
            start.set_lat_with_units(pos.lat_with_units());
            start.set_lon_with_units(pos.lon_with_units());
        }

        goby::glog.is_debug1() &&
            goby::glog << group("task") << "SurfaceDriftTaskCommon Starting Wave Height Sampling"
                       << std::endl;

        // Start wave height sampling
        auto imu_command = IMUCommand();
        imu_command.set_type(IMUCommand::START_WAVE_HEIGHT_SAMPLING);
        this->interprocess().template publish<jaiabot::groups::imu>(imu_command);

        // Is this an echo task?
        bool start_echo_sensor = this->template context<Task>().current_task()->start_echo();

        if (start_echo_sensor)
        {
            this->template context<InMission>().set_is_echo_recording(start_echo_sensor);
            // Start echo recording
            auto echo_command = EchoCommand();
            echo_command.set_type(EchoCommand::CMD_START);
            this->interprocess().template publish<jaiabot::groups::echo>(echo_command);
        }
    }

    ~SurfaceDriftTaskCommon()
    {
        if (this->machine().gps_tpv().has_location())
        {
            const auto& pos = this->machine().gps_tpv().location();
            auto& end = *drift_packet().mutable_end_location();
            end.set_lat_with_units(pos.lat_with_units());
            end.set_lon_with_units(pos.lon_with_units());
        }

        // compute estimated drift if possible
        if (drift_packet().has_start_location() && drift_packet().has_end_location() &&
            drift_packet().has_drift_duration() && drift_packet().drift_duration() > 0)
        {
            auto start = drift_packet().start_location(), end = drift_packet().end_location();
            auto start_xy = this->machine().geodesy().convert(
                     {start.lat_with_units(), start.lon_with_units()}),
                 end_xy = this->machine().geodesy().convert(
                     {end.lat_with_units(), end.lon_with_units()});

            auto sx = start_xy.x, sy = start_xy.y, ex = end_xy.x, ey = end_xy.y;
            auto dx = ex - sx, dy = ey - sy;
            auto dt = drift_packet().drift_duration_with_units();

            auto& drift = *drift_packet().mutable_estimated_drift();
            drift.set_speed_with_units(boost::units::sqrt(dx * dx + dy * dy) / dt);

            auto heading = goby::util::pi<double> / 2 * boost::units::si::radians -
                           boost::units::atan2(dy, dx);
            if (heading < 0 * boost::units::si::radians)
                heading = heading + (goby::util::pi<double> * 2 * boost::units::si::radians);
            drift.set_heading_with_units(heading);

            // Set the wave height and period
            drift_packet().set_significant_wave_height(
                this->machine().latest_significant_wave_height());

            goby::glog.is_debug1() &&
                goby::glog << group("task")
                           << "~SurfaceDriftTaskCommon Stopping Wave Height Sampling" << std::endl;

            // Stop wave height sampling
            auto imu_command = IMUCommand();
            imu_command.set_type(IMUCommand::STOP_WAVE_HEIGHT_SAMPLING);
            this->interprocess().template publish<jaiabot::groups::imu>(imu_command);

            // Is echo recording?
            bool stop_echo_sensor = this->template context<InMission>().is_echo_recording();

            if (stop_echo_sensor)
            {
                // Stop echo recording
                auto echo_command = EchoCommand();
                echo_command.set_type(EchoCommand::CMD_STOP);
                this->interprocess().template publish<jaiabot::groups::echo>(echo_command);
            }
        }
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

        if (now >= drift_time_stop_)
        {
            this->post_event(EvTaskComplete());
        }

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        this->interprocess().template publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }

    DriftPacket& drift_packet()
    {
        return *(this->template context<Task>().task_packet().mutable_drift());
    }

    using reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvLoop, SurfaceDriftTaskCommon,
                                                              &SurfaceDriftTaskCommon::loop>>;

  private:
    goby::time::SteadyClock::time_point drift_time_stop_;
};

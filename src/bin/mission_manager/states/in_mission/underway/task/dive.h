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
struct Dive;
#else
struct Dive : boost::statechart::state<Dive, Task, dive::DivePrep>, AppMethodsAccess<Dive>
{
    using StateBase = boost::statechart::state<Dive, Task, dive::DivePrep>;

    Dive(typename StateBase::my_context c)
    : StateBase(c)
    {
        // we currently start at the surface
        quantity<si::length> depth = 0 * si::meters + current_dive().depth_interval_with_units();
        quantity<si::length> max_depth = current_dive().max_depth_with_units();

        // subtracting eps ensures we don't double up on the max_depth
        // when the interval divides evenly into max depth
        while (depth < max_depth - cfg().dive_depth_eps_with_units())
        {
            dive_depths_.push_back(depth);
            depth += current_dive().depth_interval_with_units();
        }
        // always add max_depth at the end
        dive_depths_.push_back(max_depth);
        dive_packet().set_depth_achieved(0);
        dive_packet().set_bottom_dive(false);

        glog.is_debug1() && glog << group("task") << "Dive::Dive Starting Bottom Type Sampling"
                                << std::endl;

        // Start bottom type sampling
        auto imu_command = IMUCommand();
        imu_command.set_type(IMUCommand::START_BOTTOM_TYPE_SAMPLING);
        this->interprocess().template publish<jaiabot::groups::imu>(imu_command);

        boost::optional<protobuf::MissionTask> current_task = context<Task>().current_task();
        // Is this an echo task?
        bool start_echo_sensor = current_task ? current_task->start_echo() : false;

        if (start_echo_sensor)
        {
            context<InMission>().set_is_echo_recording(start_echo_sensor);
            // Start echo recording
            auto echo_command = EchoCommand();
            echo_command.set_type(EchoCommand::CMD_START);
            this->interprocess().template publish<jaiabot::groups::echo>(echo_command);
        }
    }

    ~Dive()
    {
        // compute dive rate based on dz / (sum of dt while in PoweredDescent)
        quantity<si::time> dt(dive_duration_);
        quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
        quantity<si::velocity> vz = dz / dt;
        dive_packet().set_dive_rate_with_units(vz);

        // ensure we don't exceed the bounds on the DCCL repeated field
        const auto max_measurement_size = dive_packet()
                                            .GetDescriptor()
                                            ->FindFieldByName("measurement")
                                            ->options()
                                            .GetExtension(dccl::field)
                                            .max_repeat();
        if (dive_packet().measurement_size() > max_measurement_size)
        {
            std::vector<jaiabot::utils::Point> measurements;
            measurements.reserve(dive_packet().measurement_size());
            for (int measurement_index = 0; measurement_index < dive_packet().measurement_size();
                 ++measurement_index)
            {
                const auto& measurement = dive_packet().measurement(measurement_index);
                measurements.push_back(
                    {static_cast<double>(measurement_index),
                     measurement.has_mean_depth() ? measurement.mean_depth() : 0.0});
            }

            const auto selected_indices =
                jaiabot::utils::downsampleIndices(measurements, max_measurement_size);
            std::vector<protobuf::DivePacket::Measurements> selected_measurements;
            selected_measurements.reserve(selected_indices.size());
            for (const auto selected_index : selected_indices)
                selected_measurements.push_back(dive_packet().measurement(selected_index));

            glog.is_warn() && glog << "Number of measurements (" << dive_packet().measurement_size()
                                << ") exceed DivePacket maximum of " << max_measurement_size
                                << ". Downsampling." << std::endl;
            dive_packet().clear_measurement();
            for (const auto& measurement : selected_measurements)
                *dive_packet().add_measurement() = measurement;
        }

        glog.is_debug1() && glog << group("task") << "Dive::~Dive() Stopping Bottom Type Sampling"
                                << std::endl;

        // Stop bottom type sampling
        auto imu_command = IMUCommand();
        imu_command.set_type(IMUCommand::STOP_BOTTOM_TYPE_SAMPLING);
        this->interprocess().template publish<jaiabot::groups::imu>(imu_command);

        //This logic sets the bottom type based on whether a powered ascent happens, the default is hard as set in jaia_dccl.proto
        if (dive_packet().has_bottom_dive())
        {
            if (context<Dive>().has_bot_performed_powered_ascent_after_bottom())
            {
                glog.is_debug1() && glog << "PoweredAscent::depth Setting bottom type to SOFT"
                                        << "\n"
                                        << std::endl;
                // Set the bottom_type Soft
                dive_packet().set_bottom_type(
                    protobuf::DivePacket::BottomType::DivePacket_BottomType_SOFT);
            }
            else
            {
                glog.is_debug1() && glog << "Dive::~Dive Setting bottom type to HARD" << "\n"
                                        << std::endl;
                // Set the bottom_type Hard
                dive_packet().set_bottom_type(
                    protobuf::DivePacket::BottomType::DivePacket_BottomType_HARD);
            }
            
        }
        
        // Calculate subsurface current if we have drift data
        // MUST have one hold, hold must be greater than 10 seconds, and drift must be greater than 15 seconds
        // Minimums are configurable in the jaiabot/src/bin/mission_managerconfig.proto file
        if (dive_packet().measurement_size() == 1 && current_dive().hold_time() >= cfg().min_subsurface_current_vector_hold_time() && context<Task>().task_packet().has_drift() && context<Task>().task_packet().drift().drift_duration() >= cfg().min_subsurface_current_vector_drift_time())
        {
            auto& dive_packet = context<Task>().task_packet().dive();
            auto& drift_packet = context<Task>().task_packet().drift();

            // Calculate where the dive actually ended (accounting for drift during GPS reacquisition)
            auto dive_end_location = jaiabot::utils::find_dive_end_location(
                machine().geodesy(),
                dive_packet.duration_to_acquire_gps(), 
                drift_packet.start_location(), 
                drift_packet.estimated_drift().speed(), 
                drift_packet.estimated_drift().heading()); 
            
            // Calculate subsurface displacement (from dive start to dive end)
            auto subsurface_displacement = jaiabot::utils::haversine(
                dive_packet.start_location().lat_with_units().value(), dive_packet.start_location().lon_with_units().value(),
                dive_end_location.lat_with_units().value(), dive_end_location.lon_with_units().value());
            
            // Calculate subsurface velocity and heading
            auto start_xy = this->machine().geodesy().convert(
                {dive_packet.start_location().lat_with_units(), dive_packet.start_location().lon_with_units()}),
            end_xy = this->machine().geodesy().convert(
                {dive_end_location.lat_with_units(), dive_end_location.lon_with_units()});
                
            float subsurface_velocity = subsurface_displacement / current_dive().hold_time();
            float subsurface_heading = jaiabot::utils::calculateHeading(
                start_xy.x.value(), start_xy.y.value(), end_xy.x.value(), end_xy.y.value());

            // Set the subsurface current in the dive packet
            auto* subsurface_current = context<Task>().task_packet().mutable_dive()->mutable_subsurface_current();
            subsurface_current->set_velocity(subsurface_velocity);
            subsurface_current->set_heading(subsurface_heading);
        }

        // Is echo recording?
        bool stop_echo_sensor = context<InMission>().is_echo_recording();

        if (stop_echo_sensor)
        {
            // Stop echo recording
            auto echo_command = EchoCommand();
            echo_command.set_type(EchoCommand::CMD_STOP);
            this->interprocess().template publish<jaiabot::groups::echo>(echo_command);
        }   
    }

    const protobuf::MissionTask::DiveParameters& current_dive()
    {
        return context<Task>().current_task()->dive();
    }

    bool dive_complete() { return dive_depths_.empty(); }
    boost::units::quantity<boost::units::si::length> goal_depth() { return dive_depths_.front(); }
    void pop_goal_depth() { dive_depths_.pop_front(); }
    jaiabot::protobuf::DivePacket& dive_packet()
    {
        return *context<Task>().task_packet().mutable_dive();
    }

    void add_to_dive_duration(goby::time::MicroTime time) { dive_duration_ += time; }

    void set_seafloor_reached(boost::units::quantity<boost::units::si::length> seafloor_depth)
    {
        // remove any more depth goals, and set the current goal to the measured depth
        dive_depths_.clear();
        // adjusting based on noise floor of the pressure sensor
        auto seafloor_adjustment =
            (seafloor_depth.value() - cfg().dive_depth_eps()) * boost::units::si::meters;
        dive_depths_.push_back(seafloor_adjustment);
        dive_packet().set_bottom_dive(true);

        goby::glog.is_debug2() &&
            goby::glog << "Seafloor Depth: " << seafloor_depth.value()
                       << " , Safety Depth: " << this->machine().bottom_safety_depth() << std::endl;

        if (seafloor_depth.value() <=
            (this->machine().bottom_safety_depth() + cfg().dive_depth_eps()))
        {
            dive_packet().set_reached_min_depth(true);
            this->machine().insert_warning(
                jaiabot::protobuf::
                    WARNING__MISSION__INFEASIBLE_MISSION__MINIMUM_BOTTOM_DEPTH_REACHED);
        }
    }

    void set_current_depth(const boost::units::quantity<boost::units::si::length>& current_depth)
    {
        current_depth_ = current_depth;
    }

    const boost::units::quantity<boost::units::si::length> current_depth()
    {
        return current_depth_;
    }

    void set_bot_performed_a_hold(const bool& bot_performed_hold)
    {
        bot_performed_hold_ = bot_performed_hold;
    }

    const bool has_bot_performed_a_hold() { return bot_performed_hold_; }

    void set_bot_performed_powered_ascent_after_bottom(const bool& bot_performed_powered_ascent_after_bottom)
    {
        bot_performed_powered_ascent_after_bottom_ = bot_performed_powered_ascent_after_bottom;
    }

    const bool has_bot_performed_powered_ascent_after_bottom() { return bot_performed_powered_ascent_after_bottom_; }

  private:
    std::deque<boost::units::quantity<boost::units::si::length>> dive_depths_;
    goby::time::MicroTime dive_duration_{0 * boost::units::si::seconds};
    boost::units::quantity<boost::units::si::length> current_depth_{0};
    bool bot_performed_hold_{false};
    bool bot_performed_powered_ascent_after_bottom_{false};
};
#endif

namespace dive {

    #include "dive/reacquire_gps.h"
    #include "dive/surface_drift.h"
    #include "dive/diveprep.h"
    #include "dive/powered_descent.h"
    #include "dive/hold.h"
    #include "dive/unpowered_ascent.h"
    #include "dive/powered_ascent.h"
    #include "dive/constant_heading.h"

}

// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
//   Michael Twomey <michael.twomey@jaia.tech>
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

#pragma once

// Boost
#include <boost/statechart/state_machine.hpp>

// Goby
#include <goby/util/seawater.h>

// Mission Manager app
#include "states.h"
#include "machine_common.h"
#include "mission_manager.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/dive_debug.pb.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"
#include "jaiabot/messages/echo.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/ctd.pb.h"
#include "jaiabot/messages/ppk.pb.h"

namespace jaiabot
{
namespace statechart
{

struct PreDeployment;

struct MissionManagerStateMachine
    : boost::statechart::state_machine<MissionManagerStateMachine, PreDeployment>,
      AppMethodsAccess<MissionManagerStateMachine>
{
    MissionManagerStateMachine(apps::MissionManager& a) : app_(a) {}

    void set_state(jaiabot::protobuf::MissionState state) { state_ = state; }
    jaiabot::protobuf::MissionState state() const { return state_; }

    void insert_warning(jaiabot::protobuf::Warning warning) { warnings_.insert(warning); }
    void erase_warning(jaiabot::protobuf::Warning warning) { warnings_.erase(warning); }
    void erase_infeasible_mission_warnings()
    {
        for (auto it = warnings_.begin(); it != warnings_.end();)
        {
            if (jaiabot::protobuf::Warning_Name(*it).find("INFEASIBLE_MISSION") !=
                std::string::npos)
                it = warnings_.erase(it);
            else
                ++it;
        }
    }
    void health(goby::middleware::protobuf::ThreadHealth& health)
    {
        for (auto warning : warnings_)
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_warning(warning);
        if (!warnings_.empty() && health.state() == goby::middleware::protobuf::HEALTH__OK)
            health.set_state(goby::middleware::protobuf::HEALTH__DEGRADED);
    }

    void set_setpoint_type(jaiabot::protobuf::SetpointType setpoint_type)
    {
        setpoint_type_ = setpoint_type;
    }
    jaiabot::protobuf::SetpointType setpoint_type() const { return setpoint_type_; }

    apps::MissionManager& app() { return app_; }
    const apps::MissionManager& app() const { return app_; }

    void set_mission_plan(const jaiabot::protobuf::MissionPlan& plan, bool reset_datum)
    {
        plan_ = plan;
        goby::glog.is_debug1() && goby::glog << "Set new mission plan." << std::endl;

        if (reset_datum)
        {
            // use recovery location for datum
            auto lat_origin = plan.recovery().recover_at_final_goal()
                                  ? plan.goal(0).location().lat_with_units()
                                  : plan.recovery().location().lat_with_units();
            auto lon_origin = plan.recovery().recover_at_final_goal()
                                  ? plan.goal(0).location().lon_with_units()
                                  : plan.recovery().location().lon_with_units();

            // set the local datum origin to the first goal
            goby::middleware::protobuf::DatumUpdate update;
            update.mutable_datum()->set_lat_with_units(lat_origin);
            update.mutable_datum()->set_lon_with_units(lon_origin);
            this->interprocess().template publish<goby::middleware::groups::datum_update>(update);
            geodesy_.reset(new goby::util::UTMGeodesy({lat_origin, lon_origin}));

            goby::glog.is_debug1() &&
                goby::glog << "Updated datum to: " << update.ShortDebugString() << std::endl;
        }
    }
    const jaiabot::protobuf::MissionPlan& mission_plan() const { return plan_; }

    bool has_geodesy() const { return geodesy_ ? true : false; }
    goby::util::UTMGeodesy& geodesy()
    {
        if (has_geodesy())
            return *geodesy_;
        else
            throw(goby::Exception("Uninitialized geodesy"));
    }

    void set_gps_tpv(const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv)
    {
        tpv_ = tpv;
    }
    const goby::middleware::protobuf::gpsd::TimePositionVelocity& gps_tpv() { return tpv_; }

    void calculate_pressure_adjusted(
        const jaiabot::protobuf::PressureTemperatureData& pressure_temperature)
    {
        jaiabot::protobuf::PressureAdjustedData pa;

        set_current_pressure(pressure_temperature.pressure_raw());

        pa.set_pressure_raw(pressure_temperature.pressure_raw());
        pa.set_pressure_raw_before_dive(start_of_dive_pressure());

        auto pressure_adjusted = pa.pressure_raw() - pa.pressure_raw_before_dive();

        goby::glog.is_debug2() &&
            goby::glog << "Pressure RAW: " << pa.pressure_raw()
                       << ", Pressure RAW Start of Dive: " << pa.pressure_raw_before_dive()
                       << ", Adjusted: " << pressure_adjusted << std::endl;

        pa.set_pressure_adjusted(pressure_adjusted);

        // Calculate Depth From Pressure Adjusted (current pressure - start of dive pressure), then add the depth of the pressure sensor at the start of 
        // the dive (calculated using vehicle pitch and estimated waterline), and the distance from the pressure sensor to the tail.
        auto sensor_depth = goby::util::seawater::depth(pa.pressure_adjusted_with_units(), latest_lat()) + (start_of_dive_depth_ * boost::units::si::meters);
        auto depth = goby::util::seawater::depth(pa.pressure_adjusted_with_units(), latest_lat()) + (start_of_dive_depth_ * boost::units::si::meters) + (cfg().pressure_sensor_to_tail() * boost::units::si::meters);
        post_event(statechart::EvVehicleDepth(sensor_depth, depth));

        pa.set_sensor_depth_with_units(sensor_depth);
        pa.set_depth_with_units(depth);

        interprocess().publish<jaiabot::groups::pressure_adjusted>(pa);
    }

    void set_start_of_dive_pressure(const double& start_of_dive_pressure)
    {
        start_of_dive_pressure_ = start_of_dive_pressure;
    }
    const double& start_of_dive_pressure() { return start_of_dive_pressure_; }

    void calculate_start_of_dive_depth(const boost::units::quantity<boost::units::degree::plane_angle>& pitch)
    {
        start_of_dive_depth_ = cfg().pressure_sensor_to_waterline() * sin(pitch); // m
    }    
    const double& start_of_dive_depth() { return start_of_dive_depth_; }

    void set_current_pressure(const double& current_pressure)
    {
        current_pressure_ = current_pressure;
    }
    const double& current_pressure() { return current_pressure_; }

    void set_transit_hdop_req(const double& transit_hdop) { transit_hdop_req_ = transit_hdop; }
    const double& transit_hdop_req() { return transit_hdop_req_; }

    void set_transit_pdop_req(const double& transit_pdop) { transit_pdop_req_ = transit_pdop; }
    const double& transit_pdop_req() { return transit_pdop_req_; }

    void set_after_dive_hdop_req(const double& after_dive_hdop)
    {
        after_dive_hdop_req_ = after_dive_hdop;
    }
    const double& after_dive_hdop_req() { return after_dive_hdop_req_; }

    void set_after_dive_pdop_req(const double& after_dive_pdop)
    {
        after_dive_pdop_req_ = after_dive_pdop;
    }
    const double& after_dive_pdop_req() { return after_dive_pdop_req_; }

    void set_transit_gps_fix_checks(const uint32_t& transit_gps_fix_checks)
    {
        transit_gps_fix_checks_ = transit_gps_fix_checks;
    }
    const uint32_t& transit_gps_fix_checks() { return transit_gps_fix_checks_; }

    void set_transit_gps_degraded_fix_checks(const uint32_t& transit_gps_degraded_fix_checks)
    {
        transit_gps_degraded_fix_checks_ = transit_gps_degraded_fix_checks;
    }
    const uint32_t& transit_gps_degraded_fix_checks() { return transit_gps_degraded_fix_checks_; }

    void set_after_dive_gps_fix_checks(const uint32_t& after_dive_gps_fix_checks)
    {
        after_dive_gps_fix_checks_ = after_dive_gps_fix_checks;
    }
    const uint32_t& after_dive_gps_fix_checks() { return after_dive_gps_fix_checks_; }

    void
    set_bottom_depth_safety_constant_heading(const double& bottom_depth_safety_constant_heading)
    {
        bottom_depth_safety_constant_heading_ = bottom_depth_safety_constant_heading;
    }
    const double& bottom_depth_safety_constant_heading()
    {
        return bottom_depth_safety_constant_heading_;
    }

    void set_bottom_depth_safety_constant_heading_speed(
        const double& bottom_depth_safety_constant_heading_speed)
    {
        bottom_depth_safety_constant_heading_speed_ = bottom_depth_safety_constant_heading_speed;
    }
    const double& bottom_depth_safety_constant_heading_speed()
    {
        return bottom_depth_safety_constant_heading_speed_;
    }

    void set_bottom_depth_safety_constant_heading_time(
        const double& bottom_depth_safety_constant_heading_time)
    {
        bottom_depth_safety_constant_heading_time_ = bottom_depth_safety_constant_heading_time;
    }
    const double& bottom_depth_safety_constant_heading_time()
    {
        return bottom_depth_safety_constant_heading_time_;
    }

    void set_bottom_safety_depth(const double& bottom_safety_depth)
    {
        bottom_safety_depth_ = bottom_safety_depth;
    }
    const double& bottom_safety_depth() { return bottom_safety_depth_; }

    void set_transit_speed(const boost::units::quantity<boost::units::si::velocity>& speed)
    {
        transit_speed_ = speed;
    }
    const boost::units::quantity<boost::units::si::velocity>& transit_speed_with_units()
    {
        return transit_speed_;
    }

    void set_latest_lat(const boost::units::quantity<boost::units::degree::plane_angle>& latest_lat)
    {
        latest_lat_ = latest_lat;
    }
    const boost::units::quantity<boost::units::degree::plane_angle>& latest_lat()
    {
        return latest_lat_;
    }

    void set_latest_pitch(const boost::units::quantity<boost::units::degree::plane_angle>& latest_pitch)
    {
        latest_pitch_ = latest_pitch;
    }
    const boost::units::quantity<boost::units::degree::plane_angle>& latest_pitch() { return latest_pitch_; }

    void set_latest_max_acceleration(
        const boost::units::quantity<boost::units::si::acceleration>& latest_max_acceleration)
    {
        latest_max_acceleration_ = latest_max_acceleration;
    }
    const boost::units::quantity<boost::units::si::acceleration>& latest_max_acceleration()
    {
        return latest_max_acceleration_;
    }

    void set_latest_significant_wave_height(const double& latest_significant_wave_height)
    {
        latest_significant_wave_height_ = latest_significant_wave_height;
    }
    const double& latest_significant_wave_height() { return latest_significant_wave_height_; }

    void set_create_task_packet_file(const bool& create_task_packet_file)
    {
        create_task_packet_file_ = create_task_packet_file;
    }
    const bool& create_task_packet_file() { return create_task_packet_file_; }

    void set_task_packet_file_name(const std::string& task_packet_file_name)
    {
        task_packet_file_name_ = task_packet_file_name;
    }
    const std::string& task_packet_file_name() { return task_packet_file_name_; }

    const std::string& create_file_date_time()
    {
        auto now = std::chrono::system_clock::now();
        std::time_t currentTime = std::chrono::system_clock::to_time_t(now);

        std::tm* localTime = std::localtime(&currentTime);

        std::ostringstream oss;
        oss << (localTime->tm_year + 1900) << std::setw(2) << std::setfill('0')
            << (localTime->tm_mon + 1) << std::setw(2) << std::setfill('0') << localTime->tm_mday
            << "T" << std::setw(2) << std::setfill('0') << localTime->tm_hour << std::setw(2)
            << std::setfill('0') << localTime->tm_min << std::setw(2) << std::setfill('0')
            << localTime->tm_sec;

        data_time_string_ = oss.str();

        return data_time_string_;
    }

    void set_rf_disable(const bool& rf_disable) { rf_disable_ = rf_disable; }
    const bool& rf_disable() { return rf_disable_; }

    void set_hub_id(const int32_t& hub_id) { hub_id_ = hub_id; }
    const int32_t& hub_id() { return hub_id_; }

    void set_mission_command_time(const uint64_t& mission_command_time)
    {
        mission_command_time_ = mission_command_time;
    }
    const uint64_t& mission_command_time() { return mission_command_time_; }

    void set_data_offload_exclude(const std::string& data_offload_exclude)
    {
        data_offload_exclude_ = data_offload_exclude;
    }
    const std::string& data_offload_exclude() { return data_offload_exclude_; }

  private:
    apps::MissionManager& app_;
    jaiabot::protobuf::MissionState state_{jaiabot::protobuf::PRE_DEPLOYMENT__IDLE};
    jaiabot::protobuf::MissionPlan plan_;
    jaiabot::protobuf::SetpointType setpoint_type_{jaiabot::protobuf::SETPOINT_STOP};
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
    std::set<jaiabot::protobuf::Warning> warnings_;
    goby::middleware::protobuf::gpsd::TimePositionVelocity tpv_;
    double transit_hdop_req_{cfg().gps_hdop_fix()};
    double transit_pdop_req_{cfg().gps_pdop_fix()};
    double after_dive_hdop_req_{cfg().gps_after_dive_hdop_fix()};
    double after_dive_pdop_req_{cfg().gps_after_dive_pdop_fix()};
    uint32_t transit_gps_fix_checks_{cfg().total_gps_fix_checks()};
    uint32_t transit_gps_degraded_fix_checks_{cfg().total_gps_degraded_fix_checks()};
    uint32_t after_dive_gps_fix_checks_{cfg().total_after_dive_gps_fix_checks()};
    double start_of_dive_pressure_{0};
    double start_of_dive_depth_{0};
    double current_pressure_{0};
    // if we don't get latitude information, we'll compute depth based on mid-latitude
    // (45 degrees), which will introduce up to 0.27% error at 500 meters depth
    // at the equator or the poles
    boost::units::quantity<boost::units::degree::plane_angle> latest_lat_{
        45 * boost::units::degree::degrees};
    boost::units::quantity<boost::units::degree::plane_angle> latest_pitch_{0 * boost::units::degree::degrees};
    bool rf_disable_{false};
    // IMUData.max_acceleration, to characterize the bottom type
    boost::units::quantity<boost::units::si::acceleration> latest_max_acceleration_{
        0 * boost::units::si::meter_per_second_squared};
    double latest_significant_wave_height_{0};
    double bottom_depth_safety_constant_heading_{0};
    double bottom_depth_safety_constant_heading_speed_{0};
    double bottom_depth_safety_constant_heading_time_{0};
    double bottom_safety_depth_{cfg().min_depth_safety()};
    boost::units::quantity<boost::units::si::velocity> transit_speed_{
        2.0 * boost::units::si::meters_per_second};
    // Task Packet
    bool create_task_packet_file_{true};
    std::string task_packet_file_name_{""};
    std::string data_time_string_{""};
    int32_t hub_id_{0};
    std::string data_offload_exclude_{""};
    uint64_t mission_command_time_{0};
};

} // namespace statechart
} // namespace jaiabot

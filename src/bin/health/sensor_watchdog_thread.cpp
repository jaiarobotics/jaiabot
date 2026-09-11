// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
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

#include "system_thread.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/pam.pb.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"
#include "jaiabot/messages/sensor/salinity.pb.h"
#include "jaiabot/messages/tsys01.pb.h"

using goby::glog;

jaiabot::apps::SensorWatchdogThread::SensorWatchdogThread(
    const jaiabot::config::SensorWatchdogConfig& cfg)
    : HealthMonitorThread(cfg, "sensor_watchdog", 1.0 * boost::units::si::hertz)
{
    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const protobuf::IMUData& /*data*/)
        { last_imu_data_time_ = goby::time::SteadyClock::now(); });

    interprocess().subscribe<jaiabot::groups::raw_salinity>(
        [this](const protobuf::SalinityData& /*data*/)
        { last_salinity_data_time_ = goby::time::SteadyClock::now(); });

    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const protobuf::PressureTemperatureData& /*data*/)
        { last_pressure_temperature_data_time_ = goby::time::SteadyClock::now(); });

    interprocess().subscribe<jaiabot::groups::tsys01>(
        [this](const protobuf::TSYS01Data& /*data*/)
        { last_tsys01_data_time_ = goby::time::SteadyClock::now(); });

    interprocess().subscribe<jaiabot::groups::pam>(
        [this](const protobuf::PamData& /*data*/)
        { last_pam_data_time_ = goby::time::SteadyClock::now(); });
}

bool jaiabot::apps::SensorWatchdogThread::timed_out(const goby::time::SteadyClock::time_point& last,
                                                    int timeout_seconds) const
{
    return last + std::chrono::seconds(timeout_seconds) < goby::time::SteadyClock::now();
}

void jaiabot::apps::SensorWatchdogThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(thread_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (timed_out(last_imu_data_time_, cfg().imu_data_report_timeout_seconds()))
    {
        glog.is_warn() && glog << "Timeout on IMU data" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_IMU);

        if (timed_out(last_imu_trigger_issue_time_, cfg().imu_trigger_issue_timeout_seconds()))
        {
            jaiabot::protobuf::IMUIssue imu_issue;
            imu_issue.set_solution(cfg().imu_issue_solution());
            interprocess().publish<jaiabot::groups::imu>(imu_issue);
            last_imu_trigger_issue_time_ = goby::time::SteadyClock::now();
        }
    }

    if (cfg().salinity_enabled() &&
        timed_out(last_salinity_data_time_, cfg().salinity_data_report_timeout_seconds()))
    {
        glog.is_warn() && glog << "Timeout on salinity data" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER);
    }

    if (cfg().bar30_enabled() &&
        timed_out(last_pressure_temperature_data_time_,
                  cfg().pressure_temperature_data_report_timeout_seconds()))
    {
        glog.is_warn() && glog << "Timeout on pressure temperature data" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER);
    }

    if (cfg().tsys01_enabled() &&
        timed_out(last_tsys01_data_time_, cfg().tsys01_data_report_timeout_seconds()))
    {
        glog.is_warn() && glog << "Timeout on TSYS01 temperature sensor" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER);
    }

    if (cfg().pam_enabled() &&
        timed_out(last_pam_data_time_, cfg().pam_data_report_timeout_seconds()))
    {
        glog.is_warn() && glog << "Timeout on PAM" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_PAM_DRIVER);

        if (timed_out(last_pam_trigger_issue_time_, cfg().pam_trigger_issue_timeout_seconds()))
        {
            jaiabot::protobuf::PamIssue pam_issue;
            pam_issue.set_solution(cfg().pam_issue_solution());
            interprocess().publish<jaiabot::groups::pam>(pam_issue);
            last_pam_trigger_issue_time_ = goby::time::SteadyClock::now();
        }
    }

    health.set_state(health_state);
}

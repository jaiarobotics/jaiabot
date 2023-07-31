
// Forked from:
// Copyright (C) 2018-2019 Woods Hole Oceanographic Institution
//
// This file is part of the CGSN Mooring Project ("cgsn-mooring").
//
// cgsn-mooring is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.

#ifndef JAIABOT_SRC_BIN_HEALTH_SYSTEM_THREAD_H
#define JAIABOT_SRC_BIN_HEALTH_SYSTEM_THREAD_H

#include <boost/units/systems/si.hpp>
#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot/messages/health.pb.h"

#include "config.pb.h"

namespace jaiabot
{
namespace apps
{
template <typename Config> class HealthMonitorThread : public goby::middleware::SimpleThread<Config>
{
  public:
    HealthMonitorThread(const Config& cfg, std::string thread_name,
                        boost::units::quantity<boost::units::si::frequency> report_freq)
        : goby::middleware::SimpleThread<Config>(cfg, report_freq), thread_name_(thread_name)
    {
    }
    virtual ~HealthMonitorThread() {}

    const std::string& thread_name() { return thread_name_; }

  protected:
    // sets current_state to check_state if check_state is worse (e.g. OK -> FAILED)
    // does not update current_state if check_state is better (e.g. FAILED -/-> OK)
    void demote_health(goby::middleware::protobuf::HealthState& current_state,
                       goby::middleware::protobuf::HealthState check_state)
    {
        if (current_state < check_state)
            current_state = check_state;
    }

  private:
    void loop() override { issue_status_summary(); }
    virtual void issue_status_summary() {}

  private:
    std::string thread_name_;
};

class LinuxHardwareThread : public HealthMonitorThread<jaiabot::config::LinuxHardwareConfig>
{
  public:
    LinuxHardwareThread(const jaiabot::config::LinuxHardwareConfig& cfg);
    ~LinuxHardwareThread() {}

  private:
    void issue_status_summary() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    bool read_sysinfo();
    bool read_meminfo();
    bool read_disk_usage();
    bool read_wlan_connection();
    void set_use_fraction(protobuf::LinuxHardwareStatus::Information& info);

  private:
    jaiabot::protobuf::LinuxHardwareStatus status_;

    bool sysinfo_successful_{true};
    bool meminfo_successful_{true};
    bool disk_check_successful_{true};
    bool wifi_connection_successful_{true};
};

class NTPStatusThread : public HealthMonitorThread<jaiabot::config::NTPStatusConfig>
{
  public:
    NTPStatusThread(const jaiabot::config::NTPStatusConfig& cfg);
    ~NTPStatusThread() {}

  private:
    void issue_status_summary() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    bool read_ntpq_system_status();
    bool read_ntpq_peers();

  private:
    jaiabot::protobuf::NTPStatus status_;
    bool ntpq_system_status_successful_{true};
    bool ntpq_peers_successful_{true};
};

class HelmIVPStatusThread : public HealthMonitorThread<jaiabot::config::HelmIVPStatusConfig>
{
  public:
    HelmIVPStatusThread(const jaiabot::config::HelmIVPStatusConfig& cfg);
    ~HelmIVPStatusThread() {}

  private:
    void issue_status_summary() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

  private:
    jaiabot::protobuf::HelmIVPStatus status_;
    bool helm_ivp_in_mission_{false};
    goby::time::SteadyClock::time_point helm_ivp_state_last_updated_{std::chrono::seconds(0)};
    goby::time::SteadyClock::time_point helm_ivp_desired_last_updated_{std::chrono::seconds(0)};
    goby::time::SteadyClock::time_point helm_ivp_data_last_updated_{std::chrono::seconds(0)};
};

class ArduinoStatusThread : public HealthMonitorThread<jaiabot::config::ArduinoStatusConfig>
{
  public:
    ArduinoStatusThread(const jaiabot::config::ArduinoStatusConfig& cfg);
    ~ArduinoStatusThread() {}

  private:
    void issue_status_summary() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

  private:
    jaiabot::protobuf::ArduinoStatus status_;
    goby::time::SteadyClock::time_point last_arduino_report_time_{std::chrono::seconds(0)};
    goby::time::SteadyClock::time_point vvcvoltage_last_updated_{std::chrono::seconds(0)};
};

} // namespace apps
} // namespace jaiabot

#endif

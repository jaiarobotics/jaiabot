
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

class MotorStatusThread : public HealthMonitorThread<jaiabot::config::MotorStatusConfig>
{
  public:
    MotorStatusThread(const jaiabot::config::MotorStatusConfig& cfg);
    ~MotorStatusThread() {}

  private:
    void issue_status_summary() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void send_rpm_query();

  private:
    jaiabot::protobuf::Motor status_;
    goby::time::SteadyClock::time_point last_motor_rpm_report_time_{std::chrono::seconds(0)};
    goby::time::SteadyClock::time_point last_motor_thermistor_report_time_{std::chrono::seconds(0)};
    double rpm_value_{0};

    // Original and extended map of resistance (Ohms) to temperature (°F)
    std::map<float, float> resistance_to_temperature_ = {
        {323839, -39}, {300974, -37}, {279880, -35}, {260410, -33}, {242427, -31},
        {225809, -29}, {210443, -27}, {196227, -25}, {183068, -23}, {170775, -21},
        {159488, -19}, {149024, -17}, {139316, -15}, {130306, -13}, {121939, -11},
        {114165, -9},  {106939, -7},  {100218, -5},  {93909, -3},   {88090, -1},
        {82670, 1},    {77620, 3},    {72911, 5},    {68518, 7},    {64419, 9},
        {60592, 11},   {57017, 13},   {53647, 15},   {50526, 17},   {47606, 19},
        {44874, 21},   {42317, 23},   {39921, 25},   {37676, 27},   {35573, 29},
        {33599, 31},   {31732, 33},   {29996, 35},   {28365, 37},   {26834, 39},
        {25395, 41},   {24042, 43},   {22770, 45},   {21573, 47},   {20446, 49},
        {19376, 51},   {18378, 53},   {17437, 55},   {16550, 57},   {15714, 59},
        {14925, 61},   {14180, 63},   {13478, 65},   {12814, 67},   {12182, 69},
        {11590, 71},   {11030, 73},   {10501, 75},   {10000, 77},   {9526, 79},
        {9078, 81},    {8653, 83},    {8251, 85},    {7866, 87},    {7505, 89},
        {7163, 91},    {6838, 93},    {6530, 95},    {6238, 97},    {5960, 99},
        {5697, 101},   {5447, 103},   {5207, 105},   {4981, 107},   {4766, 109},
        {4561, 111},   {4367, 113},   {4182, 115},   {4006, 117},   {3838, 119},
        {3679, 121},   {3525, 123},   {3380, 125},   {3242, 127},   {3111, 129},
        {2985, 131},   {2865, 133},   {2751, 135},   {2642, 137},   {2538, 139},
        {2438, 141},   {2343, 143},   {2252, 145},   {2165, 147},   {2082, 149},
        {2003, 151},   {1927, 153},   {1855, 155},   {1785, 157},   {1718, 159},
        {1655, 161},   {1594, 163},   {1536, 165},   {1480, 167},   {1427, 169},
        {1375, 171},   {1326, 173},   {1279, 175},   {1234, 177},   {1190, 179},
        {1149, 181},   {1109, 183},   {1070, 185},   {1034, 187},
        
        // Extrapolated values beyond 187°F (up to 300°F, increasing by 2°F)
        {1000, 189},   {970.2, 191},  {939.91, 193}, {910.34, 195}, {881.45, 197},
        {853.24, 199}, {825.71, 201}, {798.83, 203}, {772.61, 205}, {747.02, 207},
        {722.05, 209}, {697.69, 211}, {673.93, 213}, {650.77, 215}, {628.18, 217},
        {606.17, 219}, {584.72, 221}, {563.83, 223}, {543.48, 225}, {523.67, 227},
        {504.38, 229}, {485.61, 231}, {467.34, 233}, {449.57, 235}, {432.28, 237},
        {415.48, 239}, {399.14, 241}, {383.26, 243}, {367.84, 245}, {352.86, 247},
        {338.32, 249}, {324.21, 251}, {310.51, 253}, {297.22, 255}, {284.34, 257},
        {271.85, 259}, {259.75, 261}, {248.02, 263}, {236.68, 265}, {225.70, 267},
        {215.08, 269}, {204.82, 271}, {194.91, 273}, {185.34, 275}, {176.10, 277},
        {167.18, 279}, {158.59, 281}, {150.31, 283}, {142.34, 285}, {134.67, 287},
        {127.30, 289}, {120.22, 291}, {113.43, 293}, {106.91, 295}, {100.68, 297},
        {94.71, 299},  {89.01, 301},  {83.56, 303},  {78.36, 305},  {73.41, 307},
        {68.69, 309},  {64.20, 311},  {59.94, 313},  {55.90, 315},  {52.06, 317},
        {48.43, 319},  {45.00, 321},  {41.75, 323},  {38.70, 325},  {35.83, 327},
        {33.14, 329},  {30.61, 331},  {28.26, 333},  {26.07, 335},  {24.04, 337},
        {22.17, 339},  {20.44, 341},  {18.87, 343},  {17.43, 345},  {16.14, 347},
        {14.98, 349},  {13.95, 351}
    };
};

} // namespace apps
} // namespace jaiabot

#endif

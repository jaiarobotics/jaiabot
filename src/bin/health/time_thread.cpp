// Forked from:
// Copyright (C) 2018-2019 Woods Hole Oceanographic Institution
//
// This file is part of the CGSN Mooring Project ("cgsn-mooring").
//
// cgsn-mooring is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.

#include <cmath>
#include <map>
#include <sstream>

#include <boost/algorithm/string.hpp>
#include <boost/units/io.hpp>

#include "system_thread.h"

#include "jaiabot/groups.h"

using goby::glog;

namespace
{
bool try_convert_to_int(const std::string& s, int& i, int base = 10)
{
    try
    {
        i = std::stoi(s, nullptr, base);
        return true;
    }
    catch (std::exception& e)
    {
        return false;
    }
}

bool try_convert_to_float(const std::string& s, float& f)
{
    try
    {
        f = std::stof(s);
        return true;
    }
    catch (std::exception& e)
    {
        return false;
    }
}

bool try_convert_to_double(const std::string& s, double& d)
{
    try
    {
        d = std::stod(s);
        return true;
    }
    catch (std::exception& e)
    {
        return false;
    }
}

std::vector<std::string> split_csv(std::string line)
{
    std::vector<std::string> fields;
    boost::trim(line);
    boost::split(fields, line, boost::is_any_of(","));
    return fields;
}
} // namespace

jaiabot::apps::ChronyStatusThread::ChronyStatusThread(
    const jaiabot::config::ChronyStatusConfig& cfg)
    : HealthMonitorThread(cfg, "chrony_status", 1.0 / 60.0 * boost::units::si::hertz)
{
}

void jaiabot::apps::ChronyStatusThread::issue_status_summary()
{
    status_.Clear();
    chrony_tracking_successful_ = read_chrony_tracking();
    chrony_sources_successful_ = read_chrony_sources();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::time_status>(status_);
}

bool jaiabot::apps::ChronyStatusThread::run_chronyc(const std::string& command, std::string& result)
{
    // -c gives comma separated values rather than the human readable tables
    const std::string chronyc_command = "/usr/bin/chronyc -c " + command;

    FILE* fp = popen(chronyc_command.c_str(), "r");
    if (!fp)
    {
        glog.is_warn() && glog << group(thread_name())
                               << "Failed to open pipe for command: " << chronyc_command
                               << std::endl;
        return false;
    }

    char output[256];
    while (fgets(output, sizeof(output) - 1, fp) != NULL) { result += output; }

    int rc = pclose(fp);
    if (rc)
    {
        glog.is_warn() && glog << group(thread_name()) << "Failed to run " << chronyc_command
                               << std::endl;
        return false;
    }

    glog.is_debug2() && glog << group(thread_name()) << chronyc_command << ": " << result
                             << std::endl;

    return true;
}

bool jaiabot::apps::ChronyStatusThread::read_chrony_tracking()
{
    std::string result;
    if (!run_chronyc("tracking", result))
        return false;

    // for example
    // 47505300,GPS,1,1786829173.850841072,0.000000000,0.000000000,0.000000000,0.000,0.000,0.000,0.000000001,0.010001998,2.0,Normal
    enum
    {
        TRACKING_REFERENCE_ID = 0,
        TRACKING_REFERENCE_NAME = 1,
        TRACKING_STRATUM = 2,
        TRACKING_REFERENCE_TIME = 3,
        TRACKING_SYSTEM_TIME_OFFSET = 4,
        TRACKING_LAST_OFFSET = 5,
        TRACKING_RMS_OFFSET = 6,
        TRACKING_FREQUENCY = 7,
        TRACKING_RESIDUAL_FREQUENCY = 8,
        TRACKING_SKEW = 9,
        TRACKING_ROOT_DELAY = 10,
        TRACKING_ROOT_DISPERSION = 11,
        TRACKING_UPDATE_INTERVAL = 12,
        TRACKING_LEAP_STATUS = 13
    };
    const int tracking_num_fields = 14;

    auto fields = split_csv(result);
    if (fields.size() != tracking_num_fields)
    {
        glog.is_warn() && glog << group(thread_name())
                               << "Tracking contains the wrong number of fields. Expected: "
                               << tracking_num_fields << ", parsed: " << fields.size()
                               << ". Output: " << result << std::endl;
        return false;
    }

    using boost::units::si::seconds;

    status_.set_reference_id(fields[TRACKING_REFERENCE_ID]);
    status_.set_reference_name(fields[TRACKING_REFERENCE_NAME]);

    int stratum = 0;
    if (try_convert_to_int(fields[TRACKING_STRATUM], stratum))
        status_.set_stratum(stratum);

    double reference_time = 0;
    if (try_convert_to_double(fields[TRACKING_REFERENCE_TIME], reference_time))
        status_.set_reference_time_with_units(reference_time * seconds);

    float value = std::nanf("");
    if (try_convert_to_float(fields[TRACKING_SYSTEM_TIME_OFFSET], value))
        status_.set_system_time_offset_with_units(value * seconds);
    if (try_convert_to_float(fields[TRACKING_LAST_OFFSET], value))
        status_.set_last_offset_with_units(value * seconds);
    if (try_convert_to_float(fields[TRACKING_RMS_OFFSET], value))
        status_.set_rms_offset_with_units(value * seconds);
    if (try_convert_to_float(fields[TRACKING_ROOT_DELAY], value))
        status_.set_root_delay_with_units(value * seconds);
    if (try_convert_to_float(fields[TRACKING_ROOT_DISPERSION], value))
        status_.set_root_dispersion_with_units(value * seconds);
    if (try_convert_to_float(fields[TRACKING_UPDATE_INTERVAL], value))
        status_.set_update_interval_with_units(value * seconds);

    // parts per million
    if (try_convert_to_float(fields[TRACKING_FREQUENCY], value))
        status_.set_frequency(value);
    if (try_convert_to_float(fields[TRACKING_RESIDUAL_FREQUENCY], value))
        status_.set_residual_frequency(value);
    if (try_convert_to_float(fields[TRACKING_SKEW], value))
        status_.set_skew(value);

    static const std::map<std::string, protobuf::ChronyStatus::LeapStatus> leap_statuses{
        {"Normal", protobuf::ChronyStatus::LEAP_NORMAL},
        {"Insert second", protobuf::ChronyStatus::LEAP_INSERT_SECOND},
        {"Delete second", protobuf::ChronyStatus::LEAP_DELETE_SECOND},
        {"Not synchronised", protobuf::ChronyStatus::LEAP_NOT_SYNCHRONISED}};

    auto leap_status = leap_statuses.find(fields[TRACKING_LEAP_STATUS]);
    if (leap_status == leap_statuses.end())
    {
        glog.is_warn() && glog << group(thread_name()) << "Leap status: ["
                               << fields[TRACKING_LEAP_STATUS] << "] is unknown" << std::endl;
        status_.set_leap_status(protobuf::ChronyStatus::LEAP_UNKNOWN);
        return false;
    }

    status_.set_leap_status(leap_status->second);

    return true;
}

bool jaiabot::apps::ChronyStatusThread::read_chrony_sources()
{
    std::string sources, sourcestats;
    if (!run_chronyc("sources", sources))
        return false;
    if (!run_chronyc("sourcestats", sourcestats))
        return false;

    using boost::units::si::seconds;

    // for example
    // GPS,13,13,24,0.000,0.000,0.000000000,0.000000001
    enum
    {
        STATS_NAME = 0,
        STATS_SAMPLE_POINTS = 1,
        STATS_RUNS = 2,
        STATS_SPAN = 3,
        STATS_STD_DEV = 7
    };
    const int stats_num_fields = 8;

    // chrony reports the sample statistics separately from the sources
    std::map<std::string, std::vector<std::string>> stats_by_name;
    {
        std::stringstream stats_stream(sourcestats);
        std::string line;
        while (std::getline(stats_stream, line))
        {
            if (line.empty())
                continue;

            auto fields = split_csv(line);
            if (fields.size() == stats_num_fields)
                stats_by_name[fields[STATS_NAME]] = fields;
        }
    }

    // for example
    // #,*,GPS,0,1,377,1,0.000000000,0.000000000,0.010000001
    // ^,-,192.168.1.1,2,6,377,45,0.000234000,0.000234000,0.000512000
    enum
    {
        SOURCE_MODE = 0,
        SOURCE_STATE = 1,
        SOURCE_NAME = 2,
        SOURCE_STRATUM = 3,
        SOURCE_POLL = 4,
        SOURCE_REACH = 5,
        SOURCE_LAST_RX = 6,
        SOURCE_ADJUSTED_OFFSET = 7,
        SOURCE_MEASURED_OFFSET = 8,
        SOURCE_ESTIMATED_ERROR = 9
    };
    const int source_num_fields = 10;

    bool ok = true;
    std::stringstream sources_stream(sources);
    std::string line;

    while (std::getline(sources_stream, line))
    {
        if (line.empty())
            continue;

        glog.is_debug2() && glog << group(thread_name()) << line << std::endl;

        auto fields = split_csv(line);
        if (fields.size() != source_num_fields)
        {
            glog.is_warn() && glog << group(thread_name())
                                   << "Source line contains the wrong number of fields. Expected: "
                                   << source_num_fields << ", parsed: " << fields.size()
                                   << ". Line: " << line << std::endl;
            ok = false;
            continue;
        }

        auto& source = *status_.add_source();

        char mode = fields[SOURCE_MODE].empty() ? ' ' : fields[SOURCE_MODE][0];
        if (protobuf::ChronyStatus::Source::Mode_IsValid(mode))
        {
            source.set_mode(static_cast<protobuf::ChronyStatus::Source::Mode>(mode));
        }
        else
        {
            glog.is_warn() && glog << group(thread_name()) << "Source mode: [" << mode
                                   << "] is unknown" << std::endl;
            source.set_mode(protobuf::ChronyStatus::Source::MODE_UNKNOWN);
            ok = false;
        }

        char state = fields[SOURCE_STATE].empty() ? ' ' : fields[SOURCE_STATE][0];
        if (protobuf::ChronyStatus::Source::State_IsValid(state))
        {
            source.set_state(static_cast<protobuf::ChronyStatus::Source::State>(state));
        }
        else
        {
            glog.is_warn() && glog << group(thread_name()) << "Source state: [" << state
                                   << "] is unknown" << std::endl;
            source.set_state(protobuf::ChronyStatus::Source::STATE_UNKNOWN);
            ok = false;
        }

        source.set_name(fields[SOURCE_NAME]);

        int value_int = 0;
        if (try_convert_to_int(fields[SOURCE_STRATUM], value_int))
            source.set_stratum(value_int);

        // chrony reports the poll interval as a power of two
        if (try_convert_to_int(fields[SOURCE_POLL], value_int))
            source.set_poll_interval_with_units(std::pow(2, value_int) * seconds);

        // bitmask (octal)
        if (try_convert_to_int(fields[SOURCE_REACH], value_int, 8))
            source.set_reach(value_int);

        if (try_convert_to_int(fields[SOURCE_LAST_RX], value_int))
            source.set_last_sample_age_with_units(value_int * seconds);

        float value = std::nanf("");
        if (try_convert_to_float(fields[SOURCE_ADJUSTED_OFFSET], value))
            source.set_adjusted_offset_with_units(value * seconds);
        if (try_convert_to_float(fields[SOURCE_MEASURED_OFFSET], value))
            source.set_measured_offset_with_units(value * seconds);
        if (try_convert_to_float(fields[SOURCE_ESTIMATED_ERROR], value))
            source.set_estimated_error_with_units(value * seconds);

        auto stats = stats_by_name.find(fields[SOURCE_NAME]);
        if (stats != stats_by_name.end())
        {
            if (try_convert_to_int(stats->second[STATS_SAMPLE_POINTS], value_int))
                source.set_sample_points(value_int);
            if (try_convert_to_int(stats->second[STATS_RUNS], value_int))
                source.set_runs(value_int);
            if (try_convert_to_int(stats->second[STATS_SPAN], value_int))
                source.set_span_with_units(value_int * seconds);
            if (try_convert_to_float(stats->second[STATS_STD_DEV], value))
                source.set_std_dev_with_units(value * seconds);
        }

        if (source.state() == protobuf::ChronyStatus::Source::STATE_SELECTED)
            *status_.mutable_selected_source() = source;
    }

    return ok;
}

void jaiabot::apps::ChronyStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (!chrony_tracking_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__SYSTEM__CHRONY_TRACKING_QUERY_FAILED);
    }
    else if (!chrony_sources_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__SYSTEM__CHRONY_SOURCES_QUERY_FAILED);
    }
    else
    {
        if (!status_.has_selected_source())
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_warning(protobuf::WARNING__SYSTEM__CHRONY_NOT_SYNCHRONIZED);
        }
        else
        {
            if (status_.selected_source().adjusted_offset_with_units() >
                cfg().high_offset_threshold_with_units())
            {
                demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__CHRONY_OFFSET_HIGH);
            }

            if (status_.selected_source().std_dev_with_units() >
                cfg().high_std_dev_threshold_with_units())
            {
                demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__CHRONY_STD_DEV_HIGH);
            }
        }
    }

    health.set_state(health_state);
}

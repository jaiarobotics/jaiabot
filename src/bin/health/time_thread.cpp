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

std::vector<std::string> split_csv(std::string line)
{
    std::vector<std::string> fields;
    boost::trim(line);
    boost::split(fields, line, boost::is_any_of(","));
    return fields;
}
} // namespace

jaiabot::apps::NTPStatusThread::NTPStatusThread(const jaiabot::config::NTPStatusConfig& cfg)
    : HealthMonitorThread(cfg, "ntp_status", 1.0 / 60.0 * boost::units::si::hertz)
{
}

void jaiabot::apps::NTPStatusThread::issue_status_summary()
{
    status_.Clear();
    chrony_tracking_successful_ = read_chrony_tracking();
    chrony_sources_successful_ = read_chrony_sources();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::time_status>(status_);
}

bool jaiabot::apps::NTPStatusThread::run_chronyc(const std::string& command, std::string& result)
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

bool jaiabot::apps::NTPStatusThread::read_chrony_tracking()
{
    std::string result;
    if (!run_chronyc("tracking", result))
        return false;

    // reference id, reference name, stratum, reference time, system time offset,
    // last offset, RMS offset, frequency, residual frequency, skew, root delay,
    // root dispersion, update interval, leap status
    //
    // for example
    // 47505300,GPS,1,1786829173.850841072,0.000000000,0.000000000,0.000000000,0.000,0.000,0.000,0.000000001,0.010001998,2.0,Normal
    enum
    {
        TRACKING_LEAP = 13
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

    static const std::map<std::string, protobuf::NTPStatus::LeapIndicator> leap_indicators{
        {"Normal", protobuf::NTPStatus::LEAP_NONE},
        {"Insert second", protobuf::NTPStatus::LEAP_LAST_MINUTE_HAS_61_SECONDS},
        {"Delete second", protobuf::NTPStatus::LEAP_LAST_MINUTE_HAS_59_SECONDS},
        {"Not synchronised", protobuf::NTPStatus::LEAP_CLOCK_NOT_SYNCHRONIZED}};

    auto leap_indicator = leap_indicators.find(fields[TRACKING_LEAP]);
    if (leap_indicator == leap_indicators.end())
    {
        glog.is_warn() && glog << group(thread_name()) << "Leap status: [" << fields[TRACKING_LEAP]
                               << "] is unknown" << std::endl;
        status_.set_leap_indicator(protobuf::NTPStatus::LEAP_UNKNOWN);
        return false;
    }

    status_.set_leap_indicator(leap_indicator->second);

    return true;
}

bool jaiabot::apps::NTPStatusThread::read_chrony_sources()
{
    std::string sources, sourcestats;
    if (!run_chronyc("sources", sources))
        return false;
    if (!run_chronyc("sourcestats", sourcestats))
        return false;

    // name, number of sample points, number of runs, span, frequency,
    // frequency skew, offset, standard deviation
    //
    // for example
    // GPS,13,13,24,0.000,0.000,0.000000000,0.000000001
    enum
    {
        STATS_NAME = 0,
        STATS_STD_DEV = 7
    };
    const int stats_num_fields = 8;

    // chrony reports the equivalent of the ntpq jitter separately from the sources
    std::map<std::string, float> std_dev_by_name;
    {
        std::stringstream stats_stream(sourcestats);
        std::string line;
        while (std::getline(stats_stream, line))
        {
            if (line.empty())
                continue;

            auto fields = split_csv(line);
            float std_dev = std::nanf("");
            if (fields.size() == stats_num_fields &&
                try_convert_to_float(fields[STATS_STD_DEV], std_dev))
                std_dev_by_name[fields[STATS_NAME]] = std_dev;
        }
    }

    // mode, state, name, stratum, poll, reach, last rx, adjusted offset,
    // measured offset, estimated error
    //
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
        SOURCE_OFFSET = 7
    };
    const int source_num_fields = 10;

    bool ok = true;
    std::stringstream sources_stream(sources);
    std::string line;

    using boost::units::si::seconds;

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

        auto& peer = *status_.add_peer();

        char tally_code = fields[SOURCE_STATE].empty() ? ' ' : fields[SOURCE_STATE][0];
        if (protobuf::NTPStatus::NTPPeer::TallyCode_IsValid(tally_code))
        {
            peer.set_tally_code(static_cast<protobuf::NTPStatus::NTPPeer::TallyCode>(tally_code));
        }
        else
        {
            glog.is_warn() && glog << group(thread_name()) << "Tally code: [" << tally_code
                                   << "] is unknown" << std::endl;
            peer.set_tally_code(protobuf::NTPStatus::NTPPeer::PEER_CODE_UNKNOWN);
            ok = false;
        }

        // chrony has no per source reference id, so the name stands in for both
        peer.set_remote(fields[SOURCE_NAME]);
        peer.set_refid(fields[SOURCE_NAME]);

        const int stratum_max = 16;
        int stratum = stratum_max, poll_exponent = 0, reach = 0, last_rx = -1;

        if (try_convert_to_int(fields[SOURCE_STRATUM], stratum))
            peer.set_stratum(stratum);

        // chrony reports the poll interval as a power of two
        if (try_convert_to_int(fields[SOURCE_POLL], poll_exponent))
            peer.set_poll_with_units(std::pow(2, poll_exponent) * seconds);

        // bitmask (octal)
        if (try_convert_to_int(fields[SOURCE_REACH], reach, 8))
            peer.set_reach(reach);

        if (try_convert_to_int(fields[SOURCE_LAST_RX], last_rx))
            peer.set_when_with_units(last_rx * seconds);

        float offset = std::nanf("");
        if (try_convert_to_float(fields[SOURCE_OFFSET], offset))
            peer.set_offset_with_units(offset * seconds);

        auto std_dev = std_dev_by_name.find(fields[SOURCE_NAME]);
        if (std_dev != std_dev_by_name.end())
            peer.set_jitter_with_units(std_dev->second * seconds);

        if (peer.tally_code() == protobuf::NTPStatus::NTPPeer::PEER_SYSTEM_SYNC_SOURCE)
        {
            *status_.mutable_system_sync_peer() = peer;

            // '#' is a local reference clock, that is the GPS
            status_.set_sync_source(fields[SOURCE_MODE] == "#" ? protobuf::NTPStatus::SYNC_OTHER
                                                               : protobuf::NTPStatus::SYNC_NTP);
        }
    }

    return ok;
}

void jaiabot::apps::NTPStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (!chrony_tracking_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__SYSTEM__NTP_STATUS_QUERY_FAILED);
    }
    else if (!chrony_sources_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__SYSTEM__NTP_PEERS_QUERY_FAILED);
    }
    else
    {
        if (!status_.has_system_sync_peer())
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_warning(protobuf::WARNING__SYSTEM__NTP_NOT_SYNCHRONIZED);
        }
        else
        {
            if (status_.system_sync_peer().offset_with_units() >
                cfg().high_offset_threshold_with_units())
            {
                demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__NTP_OFFSET_HIGH);
            }

            if (status_.system_sync_peer().jitter_with_units() >
                cfg().high_jitter_threshold_with_units())
            {
                demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__NTP_JITTER_HIGH);
            }
        }
    }

    health.set_state(health_state);
}

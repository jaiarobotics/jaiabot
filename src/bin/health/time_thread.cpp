// Forked from:
// Copyright (C) 2018-2019 Woods Hole Oceanographic Institution
//
// This file is part of the CGSN Mooring Project ("cgsn-mooring").
//
// cgsn-mooring is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.

#include <boost/units/io.hpp>

#include "system_thread.h"

#include "jaiabot/groups.h"

using goby::glog;

jaiabot::apps::NTPStatusThread::NTPStatusThread(const jaiabot::config::NTPStatusConfig& cfg)
    : HealthMonitorThread(cfg, "ntp_status", 1.0 / 60.0 * boost::units::si::hertz)
{
}

void jaiabot::apps::NTPStatusThread::issue_status_summary()
{
    status_.Clear();
    ntpq_system_status_successful_ = read_ntpq_system_status();
    ntpq_peers_successful_ = read_ntpq_peers();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::time_status>(status_);
}

bool jaiabot::apps::NTPStatusThread::read_ntpq_system_status()
{
    FILE* fp;
    char output[64];

    std::string result;

    // see http://doc.ntp.org/4.2.6/ntpq.html#system
    const char* ntpq_command = "/usr/bin/ntpq -c rv 0";
    fp = popen(ntpq_command, "r");
    if (!fp)
    {
        glog.is_warn() && glog << group(thread_name())
                               << "Failed to open pipe for command: " << ntpq_command << std::endl;
        return false;
    }

    while (fgets(output, sizeof(output) - 1, fp) != NULL) { result += output; }
    int rc = pclose(fp);
    if (rc)
    {
        glog.is_warn() && glog << group(thread_name()) << "Failed to run " << ntpq_command
                               << std::endl;
        return false;
    }

    glog.is_debug2() && glog << group(thread_name()) << "NTP: " << result << std::endl;
    std::string status_key = "status=";
    std::string::size_type status_key_pos = result.find(status_key);
    if (status_key_pos == std::string::npos)
    {
        glog.is_warn() && glog << group(thread_name()) << "No key " << status_key
                               << " found in output of " << ntpq_command << std::endl;
        return false;
    }

    std::string::size_type space_pos = result.find(" ", status_key_pos);
    std::string status_code_str = result.substr(status_key_pos + status_key.size(),
                                                space_pos - (status_key_pos + status_key.size()));
    glog.is_debug2() && glog << group(thread_name()) << "NTP Status Code: [" << status_code_str
                             << "]" << std::endl;

    // hexadecimal code
    //
    // MSB
    // [leap indicator (2 bits)]
    // [clock source (6 bits)]
    // [event counter (4 bits)]
    // [event code (4 bits)]
    // LSB
    std::uint16_t status_code = std::stoul(status_code_str, nullptr, 16);

    const int leap_ind_bits = 2, clock_source_bits = 6, event_counter_bits = 4, event_code_bits = 4;

    const std::uint16_t leap_ind_mask = (1 << leap_ind_bits) - 1,
                        clock_source_mask = (1 << clock_source_bits) - 1,
                        event_counter_mask = (1 << event_counter_bits) - 1,
                        event_code_mask = (1 << event_code_bits) - 1;

    std::uint16_t leap_indicator =
        (status_code >> (clock_source_bits + event_counter_bits + event_code_bits)) & leap_ind_mask;
    std::uint16_t clock_source =
        (status_code >> (event_counter_bits + event_code_bits)) & clock_source_mask;
    std::uint16_t event_counter = (status_code >> event_code_bits) & event_counter_mask;
    std::uint16_t event_code = status_code & event_code_mask;

    glog.is_debug2() && glog << group(thread_name()) << std::hex << "NTP leap_indicator: 0x"
                             << leap_indicator << ", clock_source: 0x" << clock_source
                             << ", event_counter: 0x" << event_counter << ", event_code: 0x"
                             << event_code << std::dec << std::endl;

    bool ok = true;

    if (protobuf::NTPStatus::SyncSource_IsValid(clock_source))
    {
        status_.set_sync_source(static_cast<protobuf::NTPStatus::SyncSource>(clock_source));
    }
    else
    {
        glog.is_warn() && glog << group(thread_name()) << "Clock source code: 0x" << std::hex
                               << clock_source << " is unknown" << std::dec << std::endl;
        status_.set_sync_source(protobuf::NTPStatus::SYNC_UNKNOWN);
        ok = false;
    }

    if (protobuf::NTPStatus::LeapIndicator_IsValid(leap_indicator))
    {
        status_.set_leap_indicator(static_cast<protobuf::NTPStatus::LeapIndicator>(leap_indicator));
    }
    else
    {
        glog.is_warn() && glog << group(thread_name()) << "Leap Indicator code: 0x" << std::hex
                               << leap_indicator << " is unknown" << std::dec << std::endl;
        status_.set_leap_indicator(protobuf::NTPStatus::LEAP_UNKNOWN);
        ok = false;
    }

    status_.set_system_event_counter(event_counter);

    if (protobuf::NTPStatus::NTPSystemEvent_IsValid(event_code))
    {
        status_.set_last_system_event(static_cast<protobuf::NTPStatus::NTPSystemEvent>(event_code));
    }
    else
    {
        glog.is_warn() && glog << group(thread_name()) << "Event code: 0x" << std::hex << event_code
                               << " is unknown" << std::dec << std::endl;
        status_.set_last_system_event(protobuf::NTPStatus::NTP_SYSTEM_EVENT_UNKNOWN);
        ok = false;
    }

    return ok;
}

bool jaiabot::apps::NTPStatusThread::read_ntpq_peers()
{
    FILE* fp;
    char output[64];

    std::stringstream result;

    const char* ntpq_command = "/usr/bin/ntpq -c peers -n";
    fp = popen(ntpq_command, "r");
    if (!fp)
    {
        glog.is_warn() && glog << group(thread_name())
                               << "Failed to open pipe for command: " << ntpq_command << std::endl;
        return false;
    }

    while (fgets(output, sizeof(output) - 1, fp) != NULL) { result << output; }
    int rc = pclose(fp);
    if (rc)
    {
        glog.is_warn() && glog << group(thread_name()) << "Failed to run " << ntpq_command
                               << std::endl;
        return false;
    }

    bool ok = true;
    std::string line;
    // [tally]remote refid st t when poll reach delay offset jitter
    //
    // for example
    //          remote           refid      st t when poll reach   delay   offset  jitter
    // ==============================================================================
    //  0.ubuntu.pool.n .POOL.          16 p    -   64    0    0.000    0.000   0.000
    //  1.ubuntu.pool.n .POOL.          16 p    -   64    0    0.000    0.000   0.000
    //  2.ubuntu.pool.n .POOL.          16 p    -   64    0    0.000    0.000   0.000
    //  3.ubuntu.pool.n .POOL.          16 p    -   64    0    0.000    0.000   0.000
    //  ntp.ubuntu.com  .POOL.          16 p    -   64    0    0.000    0.000   0.000
    // *198.60.22.240   .XMIS.           1 u  118  128  377   75.182    0.268   0.610
    // -23.131.160.7    216.218.254.202  2 u  125  128  377   88.617   -0.288   0.816
    // +208.113.157.157 45.33.84.208     3 u  105  128  377   25.600    0.688   2.058
    // +63.211.239.58   243.50.127.182   2 u  117  128  377   59.452    0.823   0.915
    // +204.2.134.164   46.233.231.73    2 u  102  128  377   95.080    0.818   0.715
    // -91.189.89.198   145.238.203.14   2 u  101  128  377   86.921    1.307   0.601
    // +198.46.223.227  204.9.54.119     2 u  106  128  377   42.760    0.052   3.268
    // -91.189.89.199   192.53.103.108   2 u   76  128  377   86.888    1.462   0.399
    int line_number = 0;
    const int header_lines = 2;
    while (std::getline(result, line))
    {
        // skip the header
        if (line_number++ < header_lines)
            continue;

        glog.is_debug2() && glog << group(thread_name()) << line << std::endl;

        // ensure we can parse the tally code without going
        // off the end of the string
        const int min_size = 2;
        if (line.size() < min_size)
        {
            glog.is_warn() && glog << group(thread_name()) << "Peer line too short: " << line
                                   << std::endl;
            ok = false;
            continue;
        }

        const int peer_line_num_parts = 10;
        enum
        {
            PEER_REMOTE = 0,
            PEER_REFID = 1,
            PEER_STRATUM = 2,
            PEER_TYPE = 3,
            PEER_WHEN = 4,
            PEER_POLL = 5,
            PEER_REACH = 6,
            PEER_DELAY = 7,
            PEER_OFFSET = 8,
            PEER_JITTER = 9
        };

        std::vector<std::string> parts;
        // remove the tally code as it can be a space itself, throwing off the parsing
        auto line_less_tally = line.substr(1);
        boost::split(parts, line_less_tally, boost::is_any_of(" "), boost::token_compress_on);
        if (parts.size() != peer_line_num_parts)
        {
            glog.is_warn() && glog << group(thread_name())
                                   << "Peer line contains the wrong number of parts. Expected: "
                                   << peer_line_num_parts << ", parsed: " << parts.size()
                                   << ". Line: " << line << std::endl;
            ok = false;
            continue;
        }

        auto& peer = *status_.add_peer();

        // tally code + remote
        std::string remote = line.substr(0, line.find(" ", 1));
        char tally_code = remote[0];
        // erase the tally code from remote
        remote.erase(0, 1);

        if (protobuf::NTPStatus::NTPPeer::TallyCode_IsValid(tally_code))
        {
            peer.set_tally_code(static_cast<protobuf::NTPStatus::NTPPeer::TallyCode>(tally_code));
        }
        else
        {
            glog.is_warn() && glog << group(thread_name()) << "Tally code: [" << tally_code
                                   << " is unknown" << std::endl;
            peer.set_tally_code(protobuf::NTPStatus::NTPPeer::PEER_CODE_UNKNOWN);
            ok = false;
        }

        peer.set_remote(remote);
        peer.set_refid(parts[PEER_REFID]);

        auto try_convert_to_int = [](const std::string& s, int& i, int base = 10) -> bool
        {
            try
            {
                i = std::stoi(s, nullptr, base);
                return true;
            }
            catch (std::invalid_argument& e)
            {
                return false;
            }
        };

        auto try_convert_to_float = [](const std::string& s, float& f) -> bool
        {
            try
            {
                f = std::stof(s);
                return true;
            }
            catch (std::invalid_argument& e)
            {
                return false;
            }
        };

        const int stratum_max = 16;
        int stratum = stratum_max, when = -1, poll = -1, reach = 0;

        if (try_convert_to_int(parts[PEER_STRATUM], stratum))
            peer.set_stratum(stratum);

        using boost::units::si::seconds;

        // number or '-'
        if (try_convert_to_int(parts[PEER_WHEN], when))
            peer.set_when_with_units(when * seconds);
        // should be numeric
        if (try_convert_to_int(parts[PEER_POLL], poll))
            peer.set_poll_with_units(poll * seconds);
        // bitmask (octal)
        if (try_convert_to_int(parts[PEER_REACH], reach, 8))
            peer.set_reach(reach);

        float delay = std::nanf(""), offset = std::nanf(""), jitter = std::nanf("");

        using boost::units::si::milli;

        if (try_convert_to_float(parts[PEER_DELAY], delay))
            peer.set_delay_with_units(delay * milli * seconds);
        if (try_convert_to_float(parts[PEER_OFFSET], offset))
            peer.set_offset_with_units(offset * milli * seconds);
        if (try_convert_to_float(parts[PEER_JITTER], jitter))
            peer.set_jitter_with_units(jitter * milli * seconds);

        if (peer.tally_code() == protobuf::NTPStatus::NTPPeer::PEER_SYSTEM_SYNC_SOURCE ||
            peer.tally_code() == protobuf::NTPStatus::NTPPeer::PEER_PPS_SYNC)
        {
            *status_.mutable_system_sync_peer() = peer;
        }
    }

    return ok;
}

void jaiabot::apps::NTPStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (!ntpq_system_status_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__SYSTEM__NTP_STATUS_QUERY_FAILED);
    }
    else if (!ntpq_peers_successful_)
    {
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__SYSTEM__NTP_PEERS_QUERY_FAILED);
    }
    else
    {
        if (!status_.has_system_sync_peer())
        {
            demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__SYSTEM__NTP_NOT_SYNCHRONIZED);
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

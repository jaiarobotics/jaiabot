// Forked from:
// Copyright (C) 2018-2019 Woods Hole Oceanographic Institution
//
// This file is part of the CGSN Mooring Project ("cgsn-mooring").
//
// cgsn-mooring is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.

extern "C"
{
#include <sys/sysinfo.h>
}

#include <boost/filesystem.hpp>
#include <boost/units/systems/information/byte.hpp>

#include "jaiabot/groups.h"

#include "system_thread.h"
using goby::glog;

jaiabot::apps::LinuxHardwareThread::LinuxHardwareThread(
    const jaiabot::config::LinuxHardwareConfig& cfg)
    : HealthMonitorThread(cfg, "linux_hardware", 4.0 / 60.0 * boost::units::si::hertz)
{
}

void jaiabot::apps::LinuxHardwareThread::issue_status_summary()
{
    status_.Clear();
    sysinfo_successful_ = read_sysinfo();
    meminfo_successful_ = read_meminfo();
    disk_check_successful_ = read_disk_usage();
    wifi_connection_successful_ = read_wlan_connection();

    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;

    interprocess().publish<jaiabot::groups::linux_hardware_status>(status_);
}

bool jaiabot::apps::LinuxHardwareThread::read_sysinfo()
{
    struct sysinfo sys;
    if (sysinfo(&sys) != 0)
        return false;

    status_.set_uptime_with_units(sys.uptime * boost::units::si::seconds);

    auto& proc = *status_.mutable_processor();

    auto& loads = *proc.mutable_loads();
    loads.set_one_min(sys.loads[0] / (float)(1 << SI_LOAD_SHIFT));
    loads.set_five_min(sys.loads[1] / (float)(1 << SI_LOAD_SHIFT));
    loads.set_fifteen_min(sys.loads[2] / (float)(1 << SI_LOAD_SHIFT));

    proc.set_num_processes(sys.procs);
    proc.set_num_processors(get_nprocs());

    return true;
}

bool jaiabot::apps::LinuxHardwareThread::read_meminfo()
{
    std::ifstream meminfo_ifs("/proc/meminfo");

    if (!meminfo_ifs.is_open())
        return false;

    auto& mem = *status_.mutable_memory();

    std::string line;
    while (std::getline(meminfo_ifs, line))
    {
        std::vector<std::string> parts;
        boost::split(parts, line, boost::is_any_of(" "), boost::token_compress_on);

        const int expected_parts = 3;
        enum
        {
            KEY = 0,
            VALUE = 1,
            UNIT = 2
        };
        if (parts.size() != expected_parts)
            continue;

        using boost::units::information::bytes;
        using boost::units::si::kilo;

        unsigned long long value = 0;

        try
        {
            value = std::stoull(parts[VALUE]);
        }
        catch (std::invalid_argument& e)
        {
            continue;
        }

        if (parts[KEY] == "MemTotal:")
            mem.mutable_ram()->set_total_with_units(value * kilo * bytes);
        else if (parts[KEY] == "MemAvailable:")
            mem.mutable_ram()->set_available_with_units(value * kilo * bytes);
        else if (parts[KEY] == "SwapTotal:")
            mem.mutable_swap()->set_total_with_units(value * kilo * bytes);
        else if (parts[KEY] == "SwapFree:")
            mem.mutable_swap()->set_available_with_units(value * kilo * bytes);
    }
    set_use_fraction(*mem.mutable_ram());
    set_use_fraction(*mem.mutable_swap());

    // we didn't get all the values for some reason
    if (!mem.IsInitialized())
    {
        status_.clear_memory();
        return false;
    }

    return true;
}

void jaiabot::apps::LinuxHardwareThread::set_use_fraction(
    protobuf::LinuxHardwareStatus::Information& info)
{
    using quant_float_bytes =
        boost::units::quantity<protobuf::LinuxHardwareStatus::Information::available_unit, float>;
    auto total = info.total_with_units<quant_float_bytes>();
    auto available = info.available_with_units<quant_float_bytes>();

    //On the bot swap cache and swap total are 0
    //Adding logical statement to prevent dividing by zero
    if (total.value() != 0)
    {
        info.set_use_percent(100.0f * (total - available) / total);
    }
    else
    {
        //Set use percent to 0 if total is zero
        info.set_use_percent(0);
    }
}

bool jaiabot::apps::LinuxHardwareThread::read_disk_usage()
{
    using boost::units::information::bytes;
    auto& disk = *status_.mutable_disk();

    bool ok = true;
    try
    {
        auto rootfs_spaceinfo = boost::filesystem::space("/");
        disk.mutable_rootfs()->set_total_with_units(rootfs_spaceinfo.capacity * bytes);
        disk.mutable_rootfs()->set_available_with_units(rootfs_spaceinfo.available * bytes);
        set_use_fraction(*disk.mutable_rootfs());
    }
    catch (boost::filesystem::filesystem_error& e)
    {
        glog.is_warn() && glog << group(thread_name())
                               << "Failed to read rootfs filesystem information: " << e.what();
        ok = false;
    }

    try
    {
        auto data_spaceinfo = boost::filesystem::space(cfg().data_disk_mountpoint());
        disk.mutable_data()->set_total_with_units(data_spaceinfo.capacity * bytes);
        disk.mutable_data()->set_available_with_units(data_spaceinfo.available * bytes);
        set_use_fraction(*disk.mutable_data());
    }
    catch (boost::filesystem::filesystem_error& e)
    {
        glog.is_warn() && glog << group(thread_name())
                               << "Failed to read data filesystem information (from "
                               << cfg().data_disk_mountpoint() << "): " << e.what();
        ok = false;
    }
    return ok;
}

bool jaiabot::apps::LinuxHardwareThread::read_wlan_connection()
{
    std::ifstream wireless_ifs(cfg().wireless_file());
    const std::string wlan_interface = cfg().wlan_interface();

    if (!wireless_ifs.is_open())
        return false;

    auto& wifi = *status_.mutable_wifi();

    std::string line;
    while (std::getline(wireless_ifs, line))
    {
        if (line.find(wlan_interface) != std::string::npos)
        {
            float link_quality, link_quality_percentage, signal_level;
            int noise_level;
            if (sscanf(line.c_str(), "%*s %*s %f %f %d", &link_quality, &signal_level,
                       &noise_level) == 3)
            {
                // Calculate percentage for link quality
                link_quality_percentage = (link_quality / 70) * 100;

                glog.is_debug1() && glog << group(thread_name()) << "Link Quality: " << link_quality
                                         << "\n"
                                         << "Signal Level: " << signal_level << "\n"
                                         << "Noise Level: " << noise_level << std::endl;
                wifi.set_is_connected(true);
                wifi.set_link_quality(link_quality);
                wifi.set_link_quality_percentage(link_quality_percentage);
                wifi.set_signal_level(signal_level);
                wifi.set_noise_level(noise_level);
                break;
            }
            else
            {
                glog.is_warn() && glog << group(thread_name())
                                       << "Incorrect inputs read for wlan0 interface: "
                                       << line.c_str() << std::endl;
                wifi.set_is_connected(false);
                return false;
            }
        }
        else
        {
            glog.is_warn() && glog << group(thread_name())
                                   << "This line does not have wlan0 interface: " << line.c_str()
                                   << std::endl;
            wifi.set_is_connected(false);
        }
    }

    // we didn't get all the values for some reason
    if (!wifi.IsInitialized())
    {
        status_.clear_wifi();
        return false;
    }

    return true;
}

void jaiabot::apps::LinuxHardwareThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;
    {
        auto proc_health_state = goby::middleware::protobuf::HEALTH__OK;
        auto nproc = status_.processor().num_processors();
        const auto& loads = status_.processor().loads();
        if (!sysinfo_successful_)
        {
            proc_health_state = goby::middleware::protobuf::HEALTH__FAILED;
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__SYSTEM__CANNOT_READ_SYSINFO);
        }
        else
        {
            if (loads.one_min() / nproc > cfg().critical_load_factor() ||
                loads.five_min() / nproc > cfg().critical_load_factor() ||
                loads.fifteen_min() / nproc > cfg().critical_load_factor())
            {
                proc_health_state = goby::middleware::protobuf::HEALTH__FAILED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(protobuf::ERROR__SYSTEM__CPU_LOAD_FACTOR_CRITICAL);
            }
            else if (loads.one_min() / nproc > cfg().high_load_factor() ||
                     loads.five_min() / nproc > cfg().high_load_factor() ||
                     loads.fifteen_min() / nproc > cfg().high_load_factor())
            {
                proc_health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__CPU_LOAD_FACTOR_HIGH);
            }
        }

        demote_health(health_state, proc_health_state);
    }

    {
        auto mem_health_state = goby::middleware::protobuf::HEALTH__OK;

        if (!meminfo_successful_)
        {
            mem_health_state = goby::middleware::protobuf::HEALTH__FAILED;
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__SYSTEM__CANNOT_READ_MEMINFO);
        }
        else
        {
            using boost::units::quantity;
            using boost::units::information::bytes;
            using boost::units::si::mega;

            if ((100 - status_.memory().ram().use_percent()) <
                cfg().ram_critical_available_percentage())
            {
                mem_health_state = goby::middleware::protobuf::HEALTH__FAILED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(protobuf::ERROR__SYSTEM__RAM_SPACE_CRITICAL);
            }
            else if ((100 - status_.memory().ram().use_percent()) <
                     cfg().ram_low_available_percentage())
            {
                mem_health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__RAM_SPACE_LOW);
            }
        }
        demote_health(health_state, mem_health_state);
    }

    {
        auto disk_health_state = goby::middleware::protobuf::HEALTH__OK;
        if (!disk_check_successful_)
        {
            disk_health_state = goby::middleware::protobuf::HEALTH__FAILED;
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__SYSTEM__CANNOT_READ_DISK_USAGE);
        }
        else
        {
            if ((100 - status_.disk().rootfs().use_percent()) <
                cfg().disk_critical_available_percentage())
            {
                disk_health_state = goby::middleware::protobuf::HEALTH__FAILED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(protobuf::ERROR__SYSTEM__ROOTFS_DISK_SPACE_CRITICAL);
            }
            else if ((100 - status_.disk().rootfs().use_percent()) <
                     cfg().disk_low_available_percentage())
            {
                disk_health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__ROOTFS_DISK_SPACE_LOW);
            }

            if ((100 - status_.disk().data().use_percent()) <
                cfg().disk_critical_available_percentage())
            {
                disk_health_state = goby::middleware::protobuf::HEALTH__FAILED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(protobuf::ERROR__SYSTEM__DATA_DISK_SPACE_CRITICAL);
            }
            else if ((100 - status_.disk().data().use_percent()) <
                     cfg().disk_low_available_percentage())
            {
                disk_health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
                health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_warning(protobuf::WARNING__SYSTEM__DATA_DISK_SPACE_LOW);
            }
        }

        demote_health(health_state, disk_health_state);
    }

    health.set_state(health_state);
}

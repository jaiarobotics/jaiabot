// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   nIck Marshall <nick.marshall@jaia.tech>
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

#include <boost/units/io.hpp>
#include <goby/middleware/io/udp_point_to_point.h>
#include "goby/util/sci.h" // for linear_interpolate

#include "jaiabot/messages/trinket.pb.h"

#include "system_thread.h"

#include "jaiabot/groups.h"

using goby::glog;

jaiabot::apps::TrinketStatusThread::TrinketStatusThread(
    const jaiabot::config::TrinketStatusConfig& cfg)
    : HealthMonitorThread(cfg, "trinket_status", 5.0 * boost::units::si::hertz)
{
    status_.set_trinket_harness_info_type(cfg.trinket_harness_info_type());

    interthread().subscribe<jaiabot::groups::trinket_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        jaiabot::protobuf::Trinket trinket;
        if (!trinket.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize Trinknet message from UDP packet" << std::endl;

            return;
            
        }
        glog.is_debug2() && glog << "Publishing Trinket message: " << trinket.ShortDebugString() << std::endl;

        a0_voltage = trinket.trinket_data().a0_voltage();
        a4_voltage = trinket.trinket_data().a4_voltage();

        a0_resistance = trinket.trinket_data().a0_resistance();
        a4_resistance = trinket.trinket_data().a4_resistance();

        a0_temperature = trinket.trinket_data().a0_temperature();
        a4_temperature = trinket.trinket_data().a4_temperature();

        last_trinket_report_time_ = goby::time::SteadyClock::now();
    });
}

void jaiabot::apps::TrinketStatusThread::send_temp_query()
{
    glog.is_debug2() && glog << group(thread_name()) << "Sending temp query: " << std::endl;

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<jaiabot::groups::trinket_udp_out>(io_data);
}

void jaiabot::apps::TrinketStatusThread::issue_status_summary()
{
    send_temp_query();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString() << std::endl;

    interprocess().publish<jaiabot::groups::trinket_status>(status_);
}

void jaiabot::apps::TrinketStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_trinket_report_time_ + std::chrono::seconds(cfg().trinket_report_timeout_seconds()) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on trinket data" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING_JAIABOT_TRINKET_DRIVER);
    }

    health.set_state(health_state);
}
// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Matthew Ferro <matt.ferro@jaia.tech>
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

#ifndef JAIABOT_SENSORS_DRIVERS_ATLAS_SCIENTIFIC_OEM_PH_H
#define JAIABOT_SENSORS_DRIVERS_ATLAS_SCIENTIFIC_OEM_PH_H

#include "config.pb.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/atlas_scientific__oem_ph.pb.h"
#include "jaiabot/messages/sensor/sensor_core.pb.h"
#include <goby/zeromq/application/multi_thread.h>

namespace jaiabot
{
namespace apps
{
class AtlasScientificOEMPHDriver
    : public goby::zeromq::SimpleThread<jaiabot::config::AtlasOEMPHThreadConfig>
{
  public:
    AtlasScientificOEMPHDriver(const jaiabot::config::AtlasOEMPHThreadConfig& config);

  private:
    void receive_data(const sensor::protobuf::AtlasScientificOEMpH& ph_data);
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void send_cfg();

  private:
    goby::time::SteadyClock::time_point last_report_time_{goby::time::SteadyClock::now()};
    goby::time::SteadyClock::time_point last_resend_cfg_time_{goby::time::SteadyClock::now()};
    int32_t sample_rate_{10};
    int32_t report_timeout_{20};
    int32_t resend_cfg_timeout_{20};
};

} // namespace apps
} // namespace jaiabot

#endif

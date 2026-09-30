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

#ifndef JAIABOT_SENSORS_DRIVERS_TURNER_C_FLUOR_H
#define JAIABOT_SENSORS_DRIVERS_TURNER_C_FLUOR_H

#include "config.pb.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/catalog.pb.h"
#include "jaiabot/messages/sensor/sensor_core.pb.h"
#include "jaiabot/messages/sensor/turner__c_fluor.pb.h"
#include <goby/zeromq/application/multi_thread.h>

namespace jaiabot
{
namespace apps
{
class TurnerCFluorDriver
    : public goby::middleware::SimpleThread<jaiabot::config::TurnerCFluorThreadConfig>
{
  public:
    // index is the jaiabot::sensor::protobuf::SensorInstance this thread serves, which
    // distinguishes the driver threads when the payload board has more than one fluorometer
    TurnerCFluorDriver(const jaiabot::config::TurnerCFluorThreadConfig& config, int index);

  private:
    void receive_data(const sensor::protobuf::TurnerCFluor& fluor_data);
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void send_cfg();

  private:
    goby::time::SteadyClock::time_point last_report_time_{goby::time::SteadyClock::now()};
    goby::time::SteadyClock::time_point last_resend_cfg_time_{goby::time::SteadyClock::now()};
    int32_t sample_rate_{10};
    int32_t report_timeout_{20};
    int32_t resend_cfg_timeout_{20};
    jaiabot::sensor::protobuf::SensorInstance instance_{jaiabot::sensor::protobuf::INSTANCE_1};
    // distinct per instance so the two threads are distinguishable in the debug log
    std::string glog_group_{"turner_c_fluor"};
    jaiabot::sensor::protobuf::FluorCoefficients fluorometer_coefficients_;
};

} // namespace apps
} // namespace jaiabot

#endif
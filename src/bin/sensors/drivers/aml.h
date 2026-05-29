// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Nick Marshall <nick.marshall@jaia.tech>
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

#ifndef JAIABOT_SENSORS_DRIVERS_AML_SENSOR_DRIVER_H
#define JAIABOT_SENSORS_DRIVERS_AML_SENSOR_DRIVER_H

#include "config.pb.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/sensor_core.pb.h"

#include <goby/zeromq/application/simple_thread.h>


namespace jaiabot
{
namespace apps
{
class AMLSensorDriver
    : public goby::zeromq::SimpleThread<jaiabot::config::AMLThreadConfig>
{
  public:
    AMLSensorDriver(const jaiabot::config::AMLThreadConfig& config);

  private:
    void receive_data(const sensor::protobuf::AML& aml_data);
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void send_cfg();

    jaiabot::sensor::protobuf::AML::Sensor sensor_name_{jaiabot::sensor::protobuf::AML::DEFAULT};

    goby::time::SteadyClock::time_point last_report_time_{goby::time::SteadyClock::now()};
    goby::time::SteadyClock::time_point last_resend_cfg_time_{goby::time::SteadyClock::now()};
    int32_t sample_rate_{10};
    int32_t report_timeout_{20};
    int32_t resend_cfg_timeout_{20};
    sensor::protobuf::AML last_aml_reading;
    bool received_aml_reading_{false};
};

} // namespace apps
} // namespace jaiabot

#endif

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

#ifndef JAIABOT_SENSORS_DRIVERS_BLUE_ROBOTICS_BAR30_H
#define JAIABOT_SENSORS_DRIVERS_BLUE_ROBOTICS_BAR30_H

#include "jaiabot/messages/sensor/blue_robotics__bar30.pb.h"
#include "jaiabot/messages/sensor/metadata.pb.h"
#include <goby/zeromq/application/multi_thread.h>

namespace jaiabot
{
namespace apps
{
class BlueRoboticsBar30Driver
    : public goby::middleware::SimpleThread<jaiabot::sensor::protobuf::Metadata>
{
  public:
    BlueRoboticsBar30Driver(const jaiabot::sensor::protobuf::Metadata& config);

  private:
    void receive_data(const sensor::protobuf::BlueRoboticsBar30& ec_data);
};

} // namespace apps
} // namespace jaiabot

#endif
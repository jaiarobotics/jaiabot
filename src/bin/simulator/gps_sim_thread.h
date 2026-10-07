// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matt Ferro <matt.ferro@jaia.tech>
//   Toby Schneider <toby@gobysoft.org>
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

#ifndef JAIABOT_SRC_BIN_SIMULATOR_GPS_SIM_THREAD_H
#define JAIABOT_SRC_BIN_SIMULATOR_GPS_SIM_THREAD_H

#include "simulator_thread.h"

namespace jaiabot
{
namespace apps
{

class GPSSimThread : public SimulatorThread<jaiabot::config::GPSSimThread>
{
  public:
    GPSSimThread(const jaiabot::config::GPSSimThread& cfg);
    ~GPSSimThread() {}

  private:
    void handle_sim_nav(const SimNav& nav);

  private:
    int time_out_sky_{200};
    goby::time::SteadyClock::time_point sky_last_updated_{std::chrono::seconds(0)};
    goby::time::SteadyClock::time_point gps_dropout_end_{std::chrono::seconds(0)};
};

} // namespace apps
} // namespace jaiabot

#endif

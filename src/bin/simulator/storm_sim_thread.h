// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
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

#ifndef JAIABOT_SRC_BIN_SIMULATOR_STORM_SIM_THREAD_H
#define JAIABOT_SRC_BIN_SIMULATOR_STORM_SIM_THREAD_H

#include <random>

#include "simulator_thread.h"

namespace jaiabot
{
namespace apps
{

class StormSimThread : public SimulatorThread<jaiabot::config::StormSimThread>
{
  public:
    StormSimThread(const jaiabot::config::StormSimThread& cfg);
    ~StormSimThread() {}

  private:
    void handle_dive_nav(std::shared_ptr<const SimNav> dv_nav);

  private:
    //    std::default_random_engine generator_;
    //std::normal_distribution<double> temperature_distribution_;
    //std::normal_distribution<double> salinity_distribution_;
};

} // namespace apps
} // namespace jaiabot

#endif

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

#ifndef JAIABOT_SRC_BIN_SIMULATOR_EZO_EC_SIM_THREAD_H
#define JAIABOT_SRC_BIN_SIMULATOR_EZO_EC_SIM_THREAD_H

#include <random>

#include "simulator_thread.h"

namespace jaiabot
{
namespace apps
{

class EzoECSimThread : public SimulatorThread<jaiabot::config::EzoECSimThread>
{
  public:
    EzoECSimThread(const jaiabot::config::EzoECSimThread& cfg);
    ~EzoECSimThread() {}

  private:
    void handle_sim_oceanography(const SimOceanography& ocean_data);
};

} // namespace apps
} // namespace jaiabot

#endif

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

#include <goby/middleware/group.h>
#include <random>

#include "simulator_thread.h"

namespace jaiabot
{

namespace groups
{
constexpr goby::middleware::Group storm_mcu_serial_in{"jaiabot::storm::mcu_serial_in"};
constexpr goby::middleware::Group storm_mcu_serial_out{"jaiabot::storm::mcu_serial_out"};
} // namespace groups

namespace apps
{

class StormSimThread : public SimulatorThread<jaiabot::config::StormSimThread>
{
  public:
    StormSimThread(const jaiabot::config::StormSimThread& cfg);
    ~StormSimThread() {}

    struct StormSimState
    {
        goby::time::SystemClock::time_point air_descent_start{goby::time::SystemClock::now()};
        goby::time::SystemClock::time_point air_descent_end{goby::time::SystemClock::now()};

        protobuf::StormMissionSimulatorStage stage{protobuf::AIR_DESCENT};
        goby::time::SteadyClock::time_point in_water_start{goby::time::SteadyClock::now()};
        SimNav nav;

        bool parachute_attached{true};
        bool parachute_deattach_attempted{false};

        bool in_tube{true};
        bool tube_release_attempted{false};
    };

  private:
    void handle_dive_nav(std::shared_ptr<const SimNav> dv_nav);
    void compute_air_descent(const goby::time::SteadyClock::time_point& now,
                             const boost::units::quantity<boost::units::si::time>& dt);
    void compute_in_water_nav(const goby::time::SteadyClock::time_point& now,
                              const boost::units::quantity<boost::units::si::time>& dt);
    void mcu_rx(const protobuf::StormMCURequest& mcu_req);

    void send_air_descent_metadata();
    void send_air_descent_data(int packet_index);

  private:
    StormSimState state_;
    bool initial_nav_set_{false};
    goby::time::SteadyClock::time_point last_nav_process_time_;

    std::default_random_engine generator_;
    std::map<config::StormSimThread::SimFailureType, std::bernoulli_distribution> failures_;

    goby::time::SteadyClock::time_point next_air_datum_time_{goby::time::SteadyClock::now()};
    const goby::time::SteadyClock::duration air_datum_dt_;
    std::vector<std::shared_ptr<const SimOceanography>> air_descent_data_;
};
std::ostream& operator<<(std::ostream& os, const StormSimThread::StormSimState& s);

} // namespace apps
} // namespace jaiabot

#endif

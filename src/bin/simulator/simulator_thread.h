// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matt Ferro <matt.ferro@jaia.tech>
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

#ifndef JAIABOT_SRC_BIN_SIMULATOR_SIMULATOR_THREAD_H
#define JAIABOT_SRC_BIN_SIMULATOR_SIMULATOR_THREAD_H

#include <boost/units/systems/si.hpp>
#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot/messages/health.pb.h"
#include <goby/time/steady_clock.h>

#include "config.pb.h"

namespace jaiabot
{
namespace apps
{
template <typename Config> class SimulatorThread : public goby::middleware::SimpleThread<Config>
{
  public:
    SimulatorThread(const Config& cfg, std::string thread_name,
                    boost::units::quantity<boost::units::si::frequency> report_freq)
        : goby::middleware::SimpleThread<Config>(cfg, report_freq), thread_name_(thread_name)
    {
    }
    virtual ~SimulatorThread() {}

    const std::string& thread_name() { return thread_name_; }

  protected:
  private:
    void loop() override {}

  private:
    std::string thread_name_;
};

class ArduinoSimThread : public SimulatorThread<jaiabot::config::ArduinoSimThread>
{
  public:
    ArduinoSimThread(const jaiabot::config::ArduinoSimThread& cfg);
    ~ArduinoSimThread() {}

  private:
    void loop() override;

  private:
    int voltage_period_{1};
    double voltage_step_decrease_{0.1};
    double voltage_start_{24.0};
    double reset_voltage_level_{15};
    double voltage_mid_start_{12.0}; 
    goby::time::SteadyClock::time_point voltage_updated_{std::chrono::seconds(0)};
};

} // namespace apps
} // namespace jaiabot

#endif
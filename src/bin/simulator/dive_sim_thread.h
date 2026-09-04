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

#ifndef JAIABOT_SRC_BIN_SIMULATOR_DIVE_SIM_THREAD_H
#define JAIABOT_SRC_BIN_SIMULATOR_DIVE_SIM_THREAD_H

#include "simulator_thread.h"

namespace jaiabot
{
namespace apps
{

class DiveSimThread : public SimulatorThread<jaiabot::config::DiveSimThread>
{
  public:
    DiveSimThread(const jaiabot::config::DiveSimThread& cfg);
    ~DiveSimThread() {}

  private:
    void handle_moos_nav(std::shared_ptr<const SimNav> moos_nav);
    void process_desired_setpoints(const protobuf::DesiredSetpoints& desired_setpoints);
    boost::units::quantity<boost::units::si::length>
    egg_box_function(const boost::units::quantity<boost::units::si::length> mean_value,
                     const boost::units::quantity<boost::units::si::length> amplitude,
                     const boost::units::quantity<boost::units::si::length> wavelength,
                     const boost::units::quantity<boost::units::si::length> x,
                     const boost::units::quantity<boost::units::si::length> y);

  private:
    protobuf::DesiredSetpoints last_setpoints_;

    boost::units::quantity<boost::units::si::length> dive_x_, dive_y_, dive_depth_;
    goby::time::SteadyClock::time_point last_nav_process_time_;
};

} // namespace apps
} // namespace jaiabot

#endif

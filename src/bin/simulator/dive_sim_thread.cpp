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

#include <boost/units/io.hpp>
#include <numbers> // pi

#include "jaiabot/groups.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/simulator.pb.h"

#include "dive_sim_thread.h"

using goby::glog;

namespace si = boost::units::si;
using boost::units::quantity;

jaiabot::apps::DiveSimThread::DiveSimThread(const jaiabot::config::DiveSimThread& cfg)
    : SimulatorThread<jaiabot::config::DiveSimThread>(cfg, "dive_simulator",
                                                      0 * boost::units::si::hertz)
{
    glog.add_group("dive", goby::util::Colors::magenta);

    interthread().subscribe<moos_nav>([this](std::shared_ptr<const SimNav> nav)
                                      { handle_moos_nav(nav); });
    interprocess().subscribe<groups::desired_setpoints>(
        [this](const protobuf::DesiredSetpoints& desired_setpoints)
        { process_desired_setpoints(desired_setpoints); });
}

void jaiabot::apps::DiveSimThread::handle_moos_nav(std::shared_ptr<const SimNav> moos_nav)
{
    auto now = goby::time::SteadyClock::now();
    auto dt = std::chrono::duration_cast<std::chrono::microseconds>(now - last_nav_process_time_)
                  .count() *
              si::micro * si::seconds;

    auto dv_nav = std::make_shared<SimNav>(*moos_nav);

    // very simple vertical depth simulation assuming perfect controller
    if (last_setpoints_.type() == protobuf::SETPOINT_DIVE)
    {
        dv_nav->x = dive_x_;
        dv_nav->y = dive_y_;

        dive_depth_ += cfg().vertical_dive_rate_with_units() * quantity<si::time>(dt);
        if (dive_depth_ > last_setpoints_.dive_depth_with_units())
            dive_depth_ = last_setpoints_.dive_depth_with_units();

        const auto seafloor_depth = egg_box_function(
            cfg().seafloor_depth_with_units(), cfg().seafloor_amplitude_with_units(),
            cfg().seafloor_wavelength_with_units(), dv_nav->x, dv_nav->y);

        if (dive_depth_ > seafloor_depth)
            dive_depth_ = seafloor_depth;

        dv_nav->depth = dive_depth_;

        std::stringstream reset_ss;
        reset_ss << "x=" << dv_nav->x.value() << ",y=" << dv_nav->y.value()
                 << ",depth=" << dv_nav->depth.value() << ",speed=0,heading=0";

        glog.is_debug1() && glog << group("dive") << "diving, depth: " << dive_depth_ << std::endl;

        interthread().publish<to_moos>(std::make_pair(std::string("USM_RESET"), reset_ss.str()));
    }
    else
    {
        // keep updating these until we dive
        dive_x_ = moos_nav->x;
        dive_y_ = moos_nav->y;
        dive_depth_ = moos_nav->depth;
    }
    last_nav_process_time_ = now;

    interthread().publish<dive_nav>(dv_nav);
}

void jaiabot::apps::DiveSimThread::process_desired_setpoints(
    const protobuf::DesiredSetpoints& desired_setpoints)
{
    last_setpoints_ = desired_setpoints;
}

/**
 * Generates a seafloor depth value for a given coordinate based on an egg box function.
 *
 * An egg box function is a periodic function z(x, y), which is a periodic and sine-function along both
 * axes. See https://mathcurve.com/surfaces.gb/boiteaoeufs/boiteaoeufs.shtml. It's a useful function for 
 * testing the generated contour maps of the ocean floor, in simulation.
 *
 * @param mean_value Mean value of the returned function
 * @param amplitude Maximum amplitude of the generated wave crests
 * @param wavelength Wavelength of the generated waves
 * @param x x coordinate of the location to sample the function
 * @param y y coordinate of the location to sample the function
 * @return Value of the specified egg box function at the point (x, y)
 */
quantity<si::length> jaiabot::apps::DiveSimThread::egg_box_function(
    const quantity<si::length> mean_value, const quantity<si::length> amplitude,
    const quantity<si::length> wavelength, const quantity<si::length> x,
    const quantity<si::length> y)
{
    const auto k = 2 * std::numbers::pi / wavelength;
    return mean_value + amplitude * sin(k * x) * sin(k * y);
}

// Copyright 2025:
//   JaiaRobotics LLC
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_LIB_NAV_THRUST_MODEL_H
#define JAIABOT_LIB_NAV_THRUST_MODEL_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <vector>

namespace jaiabot
{
namespace nav
{
/// Nominal speed through water as a function of motor rpm.
///
/// The curve is a shape only; the navigation filter estimates a multiplicative scale on top
/// of it, so what matters here is the relative form and that it passes through the origin.
/// Negative rpm mirrors the forward curve, reduced for the lower efficiency of reverse.
class ThrustModel
{
  public:
    struct Point
    {
        double rpm;
        double speed;
    };

    /// Breakpoints fitted from fleet 50 logs, current removed via the current-triangle fit.
    static std::vector<Point> default_curve()
    {
        return {{0.0, 0.00},    {600.0, 0.42},  {1000.0, 0.83}, {1400.0, 1.24},
                {1800.0, 1.62}, {2200.0, 1.87}, {2600.0, 2.06}, {3000.0, 2.20},
                {3600.0, 2.36}};
    }

    ThrustModel() : curve_(default_curve()) {}

    /// Sorts and drops non-finite entries; falls back to the default curve if nothing is left.
    explicit ThrustModel(std::vector<Point> curve) : curve_(std::move(curve))
    {
        std::erase_if(curve_, [](const Point& p) {
            return !std::isfinite(p.rpm) || !std::isfinite(p.speed) || p.rpm < 0.0;
        });
        std::sort(curve_.begin(), curve_.end(),
                  [](const Point& a, const Point& b) { return a.rpm < b.rpm; });
        if (curve_.size() < 2) curve_ = default_curve();
    }

    const std::vector<Point>& curve() const { return curve_; }

    double reverse_efficiency() const { return reverse_efficiency_; }
    void set_reverse_efficiency(double e) { reverse_efficiency_ = std::clamp(e, 0.0, 1.0); }

    /// rpm below which the propeller is treated as producing no way through the water.
    double deadband_rpm() const { return deadband_rpm_; }
    void set_deadband_rpm(double rpm) { deadband_rpm_ = std::max(0.0, rpm); }

    /// Nominal speed through water, m/s. Signed: negative for reverse thrust.
    double speed(double rpm) const
    {
        if (!std::isfinite(rpm)) return 0.0;
        const double magnitude = std::abs(rpm);
        if (magnitude <= deadband_rpm_) return 0.0;

        const double s = interpolate(magnitude);
        return rpm >= 0.0 ? s : -s * reverse_efficiency_;
    }

  private:
    /// Piecewise-linear with flat extrapolation past the last breakpoint.
    double interpolate(double rpm) const
    {
        if (rpm <= curve_.front().rpm) return curve_.front().speed;
        if (rpm >= curve_.back().rpm) return curve_.back().speed;

        const auto upper = std::lower_bound(
            curve_.begin(), curve_.end(), rpm,
            [](const Point& p, double value) { return p.rpm < value; });
        const auto lower = std::prev(upper);
        const double span = upper->rpm - lower->rpm;
        if (span <= 0.0) return lower->speed;
        const double t = (rpm - lower->rpm) / span;
        return lower->speed + t * (upper->speed - lower->speed);
    }

    std::vector<Point> curve_;
    double reverse_efficiency_{0.7};
    double deadband_rpm_{80.0};
};

} // namespace nav
} // namespace jaiabot

#endif

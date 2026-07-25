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

#ifndef JAIABOT_LIB_NAV_GEODESY_H
#define JAIABOT_LIB_NAV_GEODESY_H

#include <cmath>

#include "jaiabot/nav/quaternion.h"

namespace jaiabot
{
namespace nav
{
/// Local tangent plane about a fixed origin, using the WGS84 radii of curvature.
/// Accurate to well under a metre over the few-kilometre scales a bot operates in.
class LocalTangentPlane
{
  public:
    static constexpr double wgs84_a = 6378137.0;
    static constexpr double wgs84_e2 = 6.69437999014e-3;

    LocalTangentPlane() = default;

    LocalTangentPlane(double origin_lat_deg, double origin_lon_deg)
        : lat0_(origin_lat_deg), lon0_(origin_lon_deg)
    {
        const double s = std::sin(deg_to_rad(lat0_));
        const double w = 1.0 - wgs84_e2 * s * s;
        // Meridian and prime-vertical radii of curvature at the origin.
        const double r_meridian = wgs84_a * (1.0 - wgs84_e2) / std::pow(w, 1.5);
        const double r_normal = wgs84_a / std::sqrt(w);
        metres_per_deg_lat_ = r_meridian * pi / 180.0;
        metres_per_deg_lon_ = r_normal * std::cos(deg_to_rad(lat0_)) * pi / 180.0;
        valid_ = true;
    }

    bool valid() const { return valid_; }
    double origin_lat() const { return lat0_; }
    double origin_lon() const { return lon0_; }

    /// Degrees to local metres, as (east, north).
    Vector2 to_local(double lat_deg, double lon_deg) const
    {
        return Vector2({(lon_deg - lon0_) * metres_per_deg_lon_,
                        (lat_deg - lat0_) * metres_per_deg_lat_});
    }

    /// Local metres (east, north) back to degrees, as (lat, lon).
    Vector2 to_geographic(const Vector2& east_north) const
    {
        return Vector2({lat0_ + east_north[1] / metres_per_deg_lat_,
                        lon0_ + east_north[0] / metres_per_deg_lon_});
    }

  private:
    double lat0_{0.0};
    double lon0_{0.0};
    double metres_per_deg_lat_{111320.0};
    double metres_per_deg_lon_{111320.0};
    bool valid_{false};
};

} // namespace nav
} // namespace jaiabot

#endif

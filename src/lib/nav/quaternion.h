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

// Frame conventions used throughout src/lib/nav, verified against fleet logs:
//
//   Body:  X forward, Y port, Z up.
//   World: X east, Y north, Z up. Referenced to magnetic north as it leaves the BNO08x,
//          to true north once declination has been applied.
//   A Quaternion maps body vectors into world vectors: v_world = q.rotate(v_body).
//   Heading is the bearing of body +X: clockwise from north, in [0, 2*pi).
//   IMUData.gravity is the *up* vector expressed in body coordinates.
//   IMUData.angular_velocity satisfies q(t+dt) = q(t) * exp_map(omega * dt).

#ifndef JAIABOT_LIB_NAV_QUATERNION_H
#define JAIABOT_LIB_NAV_QUATERNION_H

#include <cmath>
#include <numbers>
#include <optional>

#include "jaiabot/nav/linalg.h"

namespace jaiabot
{
namespace nav
{
constexpr double pi = std::numbers::pi;
constexpr double two_pi = 2.0 * pi;

/// Wrap to [-pi, pi).
inline double wrap_pi(double a)
{
    a = std::fmod(a + pi, two_pi);
    if (a < 0.0) a += two_pi;
    return a - pi;
}

/// Wrap to [0, 2*pi).
inline double wrap_two_pi(double a)
{
    a = std::fmod(a, two_pi);
    return a < 0.0 ? a + two_pi : a;
}

inline constexpr double deg_to_rad(double d) { return d * pi / 180.0; }
inline constexpr double rad_to_deg(double r) { return r * 180.0 / pi; }

/// Unit quaternion mapping body to world, stored (w, x, y, z).
class Quaternion
{
  public:
    constexpr Quaternion() = default;
    constexpr Quaternion(double w, double x, double y, double z) : w_(w), x_(x), y_(y), z_(z) {}

    constexpr double w() const { return w_; }
    constexpr double x() const { return x_; }
    constexpr double y() const { return y_; }
    constexpr double z() const { return z_; }

    static constexpr Quaternion identity() { return {1.0, 0.0, 0.0, 0.0}; }

    /// Rotation of `angle` about the world/body up axis (+Z), right-handed.
    static Quaternion about_z(double angle)
    {
        return {std::cos(0.5 * angle), 0.0, 0.0, std::sin(0.5 * angle)};
    }

    constexpr Quaternion conjugate() const { return {w_, -x_, -y_, -z_}; }

    double norm() const { return std::sqrt(w_ * w_ + x_ * x_ + y_ * y_ + z_ * z_); }

    bool is_valid() const
    {
        const double n = norm();
        return std::isfinite(n) && n > 0.5 && n < 1.5;
    }

    /// Unit-length copy, or nullopt when the quaternion is degenerate.
    std::optional<Quaternion> normalised() const
    {
        const double n = norm();
        if (!std::isfinite(n) || n < 1e-9) return std::nullopt;
        const double s = 1.0 / n;
        return Quaternion{w_ * s, x_ * s, y_ * s, z_ * s};
    }

    /// Hamilton product. `a * b` applies b first, then a.
    constexpr Quaternion operator*(const Quaternion& o) const
    {
        return {w_ * o.w_ - x_ * o.x_ - y_ * o.y_ - z_ * o.z_,
                w_ * o.x_ + x_ * o.w_ + y_ * o.z_ - z_ * o.y_,
                w_ * o.y_ - x_ * o.z_ + y_ * o.w_ + z_ * o.x_,
                w_ * o.z_ + x_ * o.y_ - y_ * o.x_ + z_ * o.w_};
    }

    /// Body vector to world vector.
    Vector3 rotate(const Vector3& v) const
    {
        const Vector3 q({x_, y_, z_});
        const Vector3 t = cross(q, v) * 2.0;
        return v + t * w_ + cross(q, t);
    }

    /// World vector to body vector.
    Vector3 rotate_inverse(const Vector3& v) const { return conjugate().rotate(v); }

    Matrix3 rotation_matrix() const
    {
        const double xx = x_ * x_, yy = y_ * y_, zz = z_ * z_;
        const double xy = x_ * y_, xz = x_ * z_, yz = y_ * z_;
        const double wx = w_ * x_, wy = w_ * y_, wz = w_ * z_;
        return Matrix3({1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz),
                        1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx),
                        1 - 2 * (xx + yy)});
    }

    /// Body +X expressed in the world frame.
    Vector3 forward() const { return rotate(Vector3({1.0, 0.0, 0.0})); }

    /// Body +Z expressed in the world frame.
    Vector3 up() const { return rotate(Vector3({0.0, 0.0, 1.0})); }

    /// Bearing of body +X, clockwise from north, in [0, 2*pi).
    double heading() const
    {
        const Vector3 f = forward();
        return wrap_two_pi(std::atan2(f[0], f[1]));
    }

    /// Nose-up-positive pitch of the forward axis above the horizontal plane.
    double pitch() const
    {
        const Vector3 f = forward();
        return std::atan2(f[2], std::hypot(f[0], f[1]));
    }

    /// Starboard-down-positive roll about the forward axis. The mast leans to the low side,
    /// so a positive roll tips body +Z toward starboard.
    double roll() const
    {
        const Vector3 world_up({0.0, 0.0, 1.0});
        const auto starboard = jaiabot::nav::normalised(cross(forward(), world_up));
        if (!starboard) return 0.0; // nose straight up or down; roll is degenerate
        const Vector3 u = up();
        return std::atan2(dot(u, *starboard), dot(u, world_up));
    }

  private:
    double w_{1.0}, x_{0.0}, y_{0.0}, z_{0.0};
};

/// Quaternion of a body-frame rotation vector, exact for small and large angles.
inline Quaternion exp_map(const Vector3& rotation_vector)
{
    const double theta = rotation_vector.norm();
    if (theta < 1e-12) // second-order expansion; avoids 0/0
        return Quaternion{1.0, 0.5 * rotation_vector[0], 0.5 * rotation_vector[1],
                          0.5 * rotation_vector[2]};
    const double half = 0.5 * theta;
    const double s = std::sin(half) / theta;
    return Quaternion{std::cos(half), rotation_vector[0] * s, rotation_vector[1] * s,
                      rotation_vector[2] * s};
}

/// Rotation vector of a unit quaternion, in [-pi, pi] magnitude.
inline Vector3 log_map(const Quaternion& q)
{
    const Quaternion p = q.w() < 0.0 ? Quaternion{-q.w(), -q.x(), -q.y(), -q.z()} : q;
    const Vector3 v({p.x(), p.y(), p.z()});
    const double n = v.norm();
    if (n < 1e-12) return v * 2.0;
    return v * (2.0 * std::atan2(n, p.w()) / n);
}

/// Smallest rotation angle between two orientations, in radians.
inline double angle_between(const Quaternion& a, const Quaternion& b)
{
    return log_map(a.conjugate() * b).norm();
}

/// Convert a magnetic-north-referenced orientation to true north.
/// `declination` is positive east, i.e. true_bearing = magnetic_bearing + declination.
inline Quaternion apply_declination(const Quaternion& q_magnetic, double declination)
{
    return Quaternion::about_z(-declination) * q_magnetic;
}

/// Build an orientation from a measured body-frame up vector and a heading.
/// Returns nullopt when the up vector is degenerate or parallel to the heading.
inline std::optional<Quaternion> from_up_and_heading(const Vector3& up_body, double heading)
{
    const auto up = normalised(up_body);
    if (!up) return std::nullopt;

    // Shortest rotation taking the measured body up onto world up, then a twist about
    // world up to land on the requested heading.
    const Vector3 world_up({0.0, 0.0, 1.0});
    const Vector3 axis = cross(*up, world_up);
    const double axis_norm = axis.norm();
    Quaternion tilt = Quaternion::identity();
    if (axis_norm > 1e-9)
        tilt = exp_map(axis * (std::atan2(axis_norm, dot(*up, world_up)) / axis_norm));
    else if (dot(*up, world_up) < 0.0)
        tilt = Quaternion{0.0, 1.0, 0.0, 0.0}; // upside down: rotate pi about body X

    const Vector3 tilted_forward = tilt.forward();
    // Degenerate when the nose ends up vertical: no horizontal component to twist.
    if (std::hypot(tilted_forward[0], tilted_forward[1]) < 1e-6) return std::nullopt;

    // Left-multiplying by about_z(theta) *decreases* the heading by theta, so the twist is
    // measured from the requested heading back to the tilt-only one.
    const double twist = wrap_pi(std::atan2(tilted_forward[0], tilted_forward[1]) - heading);
    return (Quaternion::about_z(twist) * tilt).normalised();
}

} // namespace nav
} // namespace jaiabot

#endif

#define BOOST_TEST_MODULE jaiabot_test_nav
#include <boost/test/included/unit_test.hpp>

#include <cmath>
#include <random>
#include <vector>

#include "jaiabot/nav/attitude_filter.h"
#include "jaiabot/nav/dead_reckoner.h"
#include "jaiabot/nav/geodesy.h"
#include "jaiabot/nav/linalg.h"
#include "jaiabot/nav/quaternion.h"
#include "jaiabot/nav/state_estimator.h"
#include "jaiabot/nav/thrust_model.h"
#include "jaiabot/nav/vertical_filter.h"

namespace jaiabot
{
namespace nav
{
namespace
{
constexpr double gravity_magnitude = 9.81;

/// Level orientation with the given true-north heading.
Quaternion level_attitude(double heading) { return Quaternion::about_z(0.5 * pi - heading); }

/// Unit heading vector as (east, north).
Vector2 heading_vector(double heading) { return Vector2({std::sin(heading), std::cos(heading)}); }

/// The gravity report the IMU would produce for a given orientation.
Vector3 gravity_report(const Quaternion& q)
{
    return q.rotate_inverse(Vector3({0.0, 0.0, 1.0})) * gravity_magnitude;
}

} // namespace

BOOST_AUTO_TEST_SUITE(linalg_tests)

BOOST_AUTO_TEST_CASE(identity_is_multiplicative_unit)
{
    const Matrix3 a({1, 2, 3, 4, 5, 6, 7, 8, 10});
    const Matrix3 i = Matrix3::identity();
    const Matrix3 p = a * i;
    for (std::size_t r = 0; r < 3; ++r)
        for (std::size_t c = 0; c < 3; ++c) BOOST_CHECK_CLOSE(p(r, c), a(r, c), 1e-9);
}

BOOST_AUTO_TEST_CASE(inverse_round_trips)
{
    const Matrix3 a({4, 7, 2, 3, 6, 1, 2, 5, 3});
    const auto inv = inverse(a);
    BOOST_REQUIRE(inv.has_value());
    const Matrix3 p = a * (*inv);
    for (std::size_t r = 0; r < 3; ++r)
        for (std::size_t c = 0; c < 3; ++c)
            BOOST_CHECK_SMALL(p(r, c) - (r == c ? 1.0 : 0.0), 1e-9);
}

BOOST_AUTO_TEST_CASE(inverse_rejects_singular)
{
    const Matrix3 singular({1, 2, 3, 2, 4, 6, 1, 1, 1});
    BOOST_CHECK(!inverse(singular).has_value());
}

BOOST_AUTO_TEST_CASE(inverse_uses_pivoting)
{
    // A zero leading entry forces a row swap.
    const Matrix3 a({0, 1, 0, 1, 0, 0, 0, 0, 2});
    const auto inv = inverse(a);
    BOOST_REQUIRE(inv.has_value());
    const Matrix3 p = a * (*inv);
    for (std::size_t r = 0; r < 3; ++r)
        for (std::size_t c = 0; c < 3; ++c)
            BOOST_CHECK_SMALL(p(r, c) - (r == c ? 1.0 : 0.0), 1e-12);
}

BOOST_AUTO_TEST_CASE(transpose_and_symmetrise)
{
    const Matrix<2, 3> a({1, 2, 3, 4, 5, 6});
    const Matrix<3, 2> t = a.transpose();
    BOOST_CHECK_CLOSE(t(2, 0), 3.0, 1e-9);
    BOOST_CHECK_CLOSE(t(0, 1), 4.0, 1e-9);

    const Matrix2 skewed({1, 4, 0, 2});
    const Matrix2 s = skewed.symmetrised();
    BOOST_CHECK_CLOSE(s(0, 1), 2.0, 1e-9);
    BOOST_CHECK_CLOSE(s(1, 0), 2.0, 1e-9);
}

BOOST_AUTO_TEST_CASE(blocks_round_trip)
{
    Matrix<4, 4> m{};
    m.set_block<2, 2>(1, 1, Matrix2({5, 6, 7, 8}));
    const Matrix2 b = m.block<2, 2>(1, 1);
    BOOST_CHECK_CLOSE(b(0, 0), 5.0, 1e-9);
    BOOST_CHECK_CLOSE(b(1, 1), 8.0, 1e-9);
    BOOST_CHECK_SMALL(m(0, 0), 1e-12);
}

BOOST_AUTO_TEST_CASE(vector_helpers)
{
    const Vector3 x({1, 0, 0}), y({0, 1, 0});
    const Vector3 z = cross(x, y);
    BOOST_CHECK_CLOSE(z[2], 1.0, 1e-9);
    BOOST_CHECK_CLOSE(dot(x, x), 1.0, 1e-9);

    BOOST_CHECK(!normalised(Vector3({0, 0, 0})).has_value());
    const auto n = normalised(Vector3({3, 4, 0}));
    BOOST_REQUIRE(n.has_value());
    BOOST_CHECK_CLOSE(n->norm(), 1.0, 1e-9);

    Vector3 bad({1, 0, std::nan("")});
    BOOST_CHECK(!bad.all_finite());
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(quaternion_tests)

BOOST_AUTO_TEST_CASE(identity_points_east)
{
    // The world frame is east-north-up, so an identity orientation has body +X along east.
    BOOST_CHECK_CLOSE(rad_to_deg(Quaternion::identity().heading()), 90.0, 1e-9);
}

BOOST_AUTO_TEST_CASE(level_attitude_reproduces_heading)
{
    for (double deg : {0.0, 37.0, 90.0, 180.0, 271.0, 359.0})
    {
        const double heading = deg_to_rad(deg);
        BOOST_CHECK_SMALL(wrap_pi(level_attitude(heading).heading() - heading), 1e-9);
        BOOST_CHECK_SMALL(level_attitude(heading).pitch(), 1e-9);
        BOOST_CHECK_SMALL(level_attitude(heading).roll(), 1e-9);
    }
}

BOOST_AUTO_TEST_CASE(exp_log_round_trip)
{
    for (const Vector3 v : {Vector3({0.0, 0.0, 0.0}), Vector3({1e-14, 0.0, 0.0}),
                            Vector3({0.1, -0.2, 0.3}), Vector3({2.0, 1.0, -0.5})})
    {
        const Vector3 back = log_map(exp_map(v));
        for (std::size_t i = 0; i < 3; ++i) BOOST_CHECK_SMALL(back[i] - v[i], 1e-9);
    }
}

BOOST_AUTO_TEST_CASE(rotate_matches_rotation_matrix)
{
    const Quaternion q = exp_map(Vector3({0.3, -0.7, 1.1}));
    const Vector3 v({1.5, -2.0, 0.25});
    const Vector3 a = q.rotate(v);
    const Vector3 b = q.rotation_matrix() * v;
    for (std::size_t i = 0; i < 3; ++i) BOOST_CHECK_SMALL(a[i] - b[i], 1e-12);
}

BOOST_AUTO_TEST_CASE(inverse_rotation_undoes_rotation)
{
    const Quaternion q = exp_map(Vector3({-0.4, 0.9, 0.2}));
    const Vector3 v({0.3, 1.7, -2.2});
    const Vector3 back = q.rotate_inverse(q.rotate(v));
    for (std::size_t i = 0; i < 3; ++i) BOOST_CHECK_SMALL(back[i] - v[i], 1e-12);
}

BOOST_AUTO_TEST_CASE(gravity_report_convention_is_up_in_body)
{
    // Verified against fleet logs: rotating the gravity report to the world frame yields +Z.
    const Quaternion q = exp_map(Vector3({0.2, -0.3, 0.5}));
    const Vector3 world = q.rotate(gravity_report(q));
    BOOST_CHECK_SMALL(world[0], 1e-9);
    BOOST_CHECK_SMALL(world[1], 1e-9);
    BOOST_CHECK_CLOSE(world[2], gravity_magnitude, 1e-9);
}

BOOST_AUTO_TEST_CASE(pitch_is_nose_up_positive)
{
    // Body Y is port, so raising the nose is a rotation about starboard, i.e. negative Y.
    const Quaternion nose_up = level_attitude(0.0) * exp_map(Vector3({0.0, deg_to_rad(-20.0), 0.0}));
    BOOST_CHECK_CLOSE(rad_to_deg(nose_up.pitch()), 20.0, 1e-6);
    BOOST_CHECK_SMALL(rad_to_deg(nose_up.roll()), 1e-6);

    const Quaternion nose_down =
        level_attitude(0.0) * exp_map(Vector3({0.0, deg_to_rad(20.0), 0.0}));
    BOOST_CHECK_CLOSE(rad_to_deg(nose_down.pitch()), -20.0, 1e-6);
}

BOOST_AUTO_TEST_CASE(roll_is_starboard_down_positive)
{
    const Quaternion q = level_attitude(0.0) * exp_map(Vector3({deg_to_rad(15.0), 0.0, 0.0}));
    BOOST_CHECK_CLOSE(rad_to_deg(q.roll()), 15.0, 1e-6);
    BOOST_CHECK_SMALL(rad_to_deg(q.pitch()), 1e-6);

    // Cross-check against the fleet-log identity roll = atan2(g_y, g_z).
    const Vector3 g = gravity_report(q);
    BOOST_CHECK_CLOSE(rad_to_deg(std::atan2(g[1], g[2])), 15.0, 1e-6);
}

BOOST_AUTO_TEST_CASE(pitch_matches_gravity_identity)
{
    const Quaternion q = level_attitude(deg_to_rad(50.0)) *
                         exp_map(Vector3({0.0, deg_to_rad(-25.0), 0.0}));
    const Vector3 g = gravity_report(q);
    BOOST_CHECK_CLOSE(rad_to_deg(q.pitch()),
                      rad_to_deg(std::atan2(g[0], std::hypot(g[1], g[2]))), 1e-6);
}

BOOST_AUTO_TEST_CASE(declination_shifts_heading_east_positive)
{
    const double magnetic = deg_to_rad(100.0);
    const double declination = deg_to_rad(-13.5);
    const Quaternion q_true = apply_declination(level_attitude(magnetic), declination);
    BOOST_CHECK_CLOSE(rad_to_deg(q_true.heading()), 86.5, 1e-6);
}

BOOST_AUTO_TEST_CASE(declination_preserves_tilt)
{
    const Quaternion tilted =
        level_attitude(deg_to_rad(40.0)) * exp_map(Vector3({0.1, -0.2, 0.0}));
    const Quaternion shifted = apply_declination(tilted, deg_to_rad(12.0));
    BOOST_CHECK_CLOSE(rad_to_deg(shifted.pitch()), rad_to_deg(tilted.pitch()), 1e-6);
    BOOST_CHECK_CLOSE(rad_to_deg(shifted.roll()), rad_to_deg(tilted.roll()), 1e-6);
}

BOOST_AUTO_TEST_CASE(from_up_and_heading_round_trips)
{
    // Given the up vector and heading an orientation actually has, the orientation is
    // uniquely determined, so the reconstruction must return exactly it.
    for (double heading_deg : {0.0, 45.0, 137.0, 300.0})
        for (const Vector3 tilt : {Vector3({0.0, 0.0, 0.0}), Vector3({0.15, -0.25, 0.0}),
                                   Vector3({0.5, 0.3, 0.0})})
        {
            const Quaternion truth = level_attitude(deg_to_rad(heading_deg)) * exp_map(tilt);
            const auto q = from_up_and_heading(gravity_report(truth), truth.heading());
            BOOST_REQUIRE(q.has_value());
            BOOST_CHECK_SMALL(wrap_pi(q->heading() - truth.heading()), 1e-6);
            BOOST_CHECK_SMALL(angle_between(*q, truth), 1e-6);
        }
}

BOOST_AUTO_TEST_CASE(from_up_and_heading_rejects_degenerate_up)
{
    BOOST_CHECK(!from_up_and_heading(Vector3({0.0, 0.0, 0.0}), 0.0).has_value());
}

BOOST_AUTO_TEST_CASE(gyro_propagation_convention_matches_logs)
{
    // Verified by exhaustive search over the logs: q(t+dt) = q(t) * exp_map(omega * dt),
    // with omega the raw body rate. A clockwise heading change is a negative body-z rate.
    const double heading = deg_to_rad(10.0);
    const double turn_rate = deg_to_rad(20.0); // clockwise, i.e. heading increasing
    const double dt = 0.5;
    const Quaternion q0 = level_attitude(heading);
    const Quaternion q1 = q0 * exp_map(Vector3({0.0, 0.0, -turn_rate}) * dt);
    BOOST_CHECK_CLOSE(rad_to_deg(q1.heading()), 20.0, 1e-6);
}

BOOST_AUTO_TEST_CASE(wrap_helpers)
{
    BOOST_CHECK_SMALL(wrap_pi(2.0 * pi), 1e-12);
    // The range is [-pi, pi), so an odd multiple of pi lands on the lower bound.
    BOOST_CHECK_CLOSE(wrap_pi(3.0 * pi), -pi, 1e-12);
    BOOST_CHECK_CLOSE(wrap_two_pi(-0.5 * pi), 1.5 * pi, 1e-12);
    BOOST_CHECK_SMALL(wrap_pi(deg_to_rad(359.0) - deg_to_rad(-1.0)), 1e-12);
}

BOOST_AUTO_TEST_CASE(invalid_quaternion_detected)
{
    BOOST_CHECK(Quaternion::identity().is_valid());
    BOOST_CHECK(!Quaternion(0.0, 0.0, 0.0, 0.0).is_valid());
    BOOST_CHECK(!Quaternion(0.0, 0.0, 0.0, 0.0).normalised().has_value());
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(geodesy_tests)

BOOST_AUTO_TEST_CASE(local_round_trips)
{
    const LocalTangentPlane plane(41.6576, -71.2721);
    BOOST_REQUIRE(plane.valid());
    const Vector2 local = plane.to_local(41.6600, -71.2700);
    const Vector2 geo = plane.to_geographic(local);
    BOOST_CHECK_SMALL(geo[0] - 41.6600, 1e-9);
    BOOST_CHECK_SMALL(geo[1] - (-71.2700), 1e-9);
}

BOOST_AUTO_TEST_CASE(north_and_east_have_expected_sign_and_scale)
{
    const LocalTangentPlane plane(41.6576, -71.2721);
    const Vector2 north = plane.to_local(41.6576 + 0.001, -71.2721);
    BOOST_CHECK_SMALL(north[0], 1e-6);
    BOOST_CHECK_CLOSE(north[1], 111.1, 0.5); // ~111 m per milli-degree of latitude

    const Vector2 east = plane.to_local(41.6576, -71.2721 + 0.001);
    BOOST_CHECK_GT(east[0], 0.0);
    BOOST_CHECK_SMALL(east[1], 1e-6);
    // A degree of longitude shortens by cos(latitude).
    BOOST_CHECK_CLOSE(east[0], 111.3 * std::cos(deg_to_rad(41.6576)), 1.0);
}

BOOST_AUTO_TEST_CASE(default_plane_is_invalid)
{
    BOOST_CHECK(!LocalTangentPlane().valid());
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(thrust_model_tests)

BOOST_AUTO_TEST_CASE(passes_through_origin_and_is_monotone)
{
    const ThrustModel m;
    BOOST_CHECK_SMALL(m.speed(0.0), 1e-12);
    double previous = 0.0;
    for (double rpm = 200.0; rpm <= 4000.0; rpm += 100.0)
    {
        const double s = m.speed(rpm);
        BOOST_CHECK_GE(s, previous - 1e-12);
        previous = s;
    }
}

BOOST_AUTO_TEST_CASE(deadband_and_reverse)
{
    ThrustModel m;
    m.set_deadband_rpm(100.0);
    BOOST_CHECK_SMALL(m.speed(50.0), 1e-12);
    BOOST_CHECK_SMALL(m.speed(-50.0), 1e-12);
    BOOST_CHECK_GT(m.speed(2000.0), 0.0);

    m.set_reverse_efficiency(0.5);
    BOOST_CHECK_CLOSE(m.speed(-2000.0), -0.5 * m.speed(2000.0), 1e-9);
}

BOOST_AUTO_TEST_CASE(matches_measured_operating_points)
{
    // Steady-state current-triangle fits from fleet 50: 1787 rpm -> 1.64 m/s,
    // 2511 rpm -> 2.02 m/s. The filter's speed scale absorbs the rest.
    const ThrustModel m;
    BOOST_CHECK_CLOSE(m.speed(1787.0), 1.64, 8.0);
    BOOST_CHECK_CLOSE(m.speed(2511.0), 2.02, 8.0);
}

BOOST_AUTO_TEST_CASE(extrapolates_flat_beyond_curve)
{
    const ThrustModel m;
    BOOST_CHECK_CLOSE(m.speed(9000.0), m.speed(3600.0), 1e-9);
}

BOOST_AUTO_TEST_CASE(custom_curve_is_sorted_and_sanitised)
{
    const ThrustModel m({{2000.0, 2.0}, {0.0, 0.0}, {1000.0, 1.0}});
    BOOST_CHECK_CLOSE(m.speed(1500.0), 1.5, 1e-9);

    // Too few usable points falls back to the default curve.
    const ThrustModel degenerate({{std::nan(""), 1.0}});
    BOOST_CHECK_CLOSE(degenerate.speed(1800.0), ThrustModel().speed(1800.0), 1e-9);
}

BOOST_AUTO_TEST_CASE(non_finite_rpm_is_zero)
{
    BOOST_CHECK_SMALL(ThrustModel().speed(std::nan("")), 1e-12);
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(attitude_filter_tests)

BOOST_AUTO_TEST_CASE(uninitialised_ignores_input)
{
    AttitudeFilter f;
    BOOST_CHECK(!f.initialised());
    f.propagate(Vector3({0.1, 0.0, 0.0}), 0.1);
    BOOST_CHECK(!f.update_gravity(Vector3({0.0, 0.0, 9.81})));
    BOOST_CHECK(!f.update_heading(1.0, 0.1));
}

BOOST_AUTO_TEST_CASE(initialise_recovers_attitude)
{
    const Quaternion truth =
        level_attitude(deg_to_rad(75.0)) * exp_map(Vector3({0.1, -0.15, 0.0}));
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(truth), truth.heading()));
    BOOST_CHECK_SMALL(angle_between(f.orientation(), truth), 1e-6);
}

BOOST_AUTO_TEST_CASE(gravity_update_levels_a_tilted_estimate)
{
    const Quaternion truth = level_attitude(0.0);
    AttitudeFilter f;
    f.reset(level_attitude(0.0) * exp_map(Vector3({deg_to_rad(8.0), deg_to_rad(-6.0), 0.0})));

    for (int i = 0; i < 200; ++i)
    {
        f.propagate(Vector3({0.0, 0.0, 0.0}), 0.1);
        BOOST_CHECK(f.update_gravity(gravity_report(truth)));
    }
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(f.roll())), 0.5);
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(f.pitch())), 0.5);
}

BOOST_AUTO_TEST_CASE(gravity_update_rejects_implausible_magnitude)
{
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(0.0)), 0.0));
    BOOST_CHECK(!f.update_gravity(Vector3({0.0, 0.0, 40.0})));
    BOOST_CHECK(!f.update_gravity(Vector3({0.0, 0.0, 0.5})));
    BOOST_CHECK(f.update_gravity(Vector3({0.0, 0.0, 9.81})));
}

BOOST_AUTO_TEST_CASE(gravity_update_tolerates_a_magnitude_scale_error)
{
    // Regression for finding 2: update_gravity() normalises the vector, so a pure scale error
    // (measured on 2 of 48 fleet logs: median |g| 6.4-8.5 vs. the true ~9.81, direction
    // unaffected) must not be rejected on magnitude alone - only the direction matters.
    AttitudeFilter f;
    const Quaternion tilted =
        level_attitude(0.0) * exp_map(Vector3({0.0, deg_to_rad(-15.0), 0.0}));
    BOOST_REQUIRE(f.initialise(gravity_report(tilted), 0.0));

    const Vector3 scaled_down = normalised(gravity_report(tilted)).value() * 6.5;
    BOOST_CHECK(f.update_gravity(scaled_down));
}

BOOST_AUTO_TEST_CASE(heading_update_converges)
{
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(0.0)), 0.0));
    const double target = deg_to_rad(40.0);
    for (int i = 0; i < 500; ++i)
    {
        f.propagate(Vector3({0.0, 0.0, 0.0}), 0.1);
        f.update_gravity(gravity_report(level_attitude(target)));
        f.update_heading(target, deg_to_rad(5.0));
    }
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(wrap_pi(f.heading() - target))), 1.0);
}

BOOST_AUTO_TEST_CASE(gyro_bias_is_identified)
{
    // Vehicle held still; the gyro reports a constant offset that must be learned.
    const Quaternion truth = level_attitude(deg_to_rad(20.0));
    const Vector3 bias({deg_to_rad(0.8), deg_to_rad(-0.5), deg_to_rad(0.6)});

    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(truth), truth.heading()));

    for (int i = 0; i < 6000; ++i)
    {
        f.propagate(bias, 0.1);
        f.update_gravity(gravity_report(truth));
        f.update_heading(truth.heading(), deg_to_rad(5.0));
    }

    for (std::size_t i = 0; i < 3; ++i)
        BOOST_CHECK_SMALL(rad_to_deg(f.gyro_bias()[i] - bias[i]), 0.25);
    BOOST_CHECK_SMALL(rad_to_deg(angle_between(f.orientation(), truth)), 1.0);
}

BOOST_AUTO_TEST_CASE(tracks_a_steady_turn)
{
    const double rate = deg_to_rad(10.0); // clockwise heading change
    const Vector3 gyro({0.0, 0.0, -rate});
    double heading = 0.0;
    const double dt = 0.1;

    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(heading)), heading));

    for (int i = 0; i < 300; ++i)
    {
        heading = wrap_two_pi(heading + rate * dt);
        f.propagate(gyro, dt);
        f.update_gravity(gravity_report(level_attitude(heading)));
        f.update_heading(heading, deg_to_rad(5.0));
    }
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(wrap_pi(f.heading() - heading))), 2.0);
}

BOOST_AUTO_TEST_CASE(heading_variance_grows_without_aiding)
{
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(0.0)), 0.0));
    for (int i = 0; i < 100; ++i) f.update_heading(0.0, deg_to_rad(2.0));

    const double settled = f.heading_variance();
    for (int i = 0; i < 600; ++i) f.propagate(Vector3({0.0, 0.0, 0.0}), 0.1);
    BOOST_CHECK_GT(f.heading_variance(), settled);
}

BOOST_AUTO_TEST_CASE(heading_sigma_degrades_with_reported_accuracy)
{
    const AttitudeFilter f;
    const double base = f.config().rotation_vector_heading_noise;
    BOOST_CHECK_CLOSE(f.heading_sigma(base, 3), base, 1e-9);
    BOOST_CHECK_GT(f.heading_sigma(base, 1), f.heading_sigma(base, 2));
    BOOST_CHECK_GT(f.heading_sigma(base, 0), f.heading_sigma(base, 1));
}

BOOST_AUTO_TEST_CASE(magnetometer_update_matches_rotation_vector_update)
{
    const double declination = deg_to_rad(-13.5);
    const double true_heading = deg_to_rad(65.0);
    const Quaternion truth = level_attitude(true_heading);

    // A clean field: horizontal component along magnetic north, plus a downward component.
    const double magnetic_heading = wrap_two_pi(true_heading - declination);
    const Quaternion q_magnetic = level_attitude(magnetic_heading);
    const Vector3 field_world_magnetic({0.0, 20.0, -45.0});
    const Vector3 field_body = q_magnetic.rotate_inverse(field_world_magnetic);

    AttitudeFilter mag_filter, rv_filter;
    BOOST_REQUIRE(mag_filter.initialise(gravity_report(truth), deg_to_rad(50.0)));
    BOOST_REQUIRE(rv_filter.initialise(gravity_report(truth), deg_to_rad(50.0)));

    for (int i = 0; i < 400; ++i)
    {
        mag_filter.propagate(Vector3({0.0, 0.0, 0.0}), 0.1);
        mag_filter.update_gravity(gravity_report(truth));
        mag_filter.update_magnetometer(field_body, declination, 3);

        rv_filter.propagate(Vector3({0.0, 0.0, 0.0}), 0.1);
        rv_filter.update_gravity(gravity_report(truth));
        rv_filter.update_rotation_vector(q_magnetic, declination, 3);
    }

    BOOST_CHECK_SMALL(rad_to_deg(std::abs(wrap_pi(mag_filter.heading() - true_heading))), 1.5);
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(wrap_pi(rv_filter.heading() - true_heading))), 1.5);
}

BOOST_AUTO_TEST_CASE(heading_outlier_is_gated_out)
{
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(0.0)), 0.0));
    for (int i = 0; i < 300; ++i)
    {
        f.propagate(Vector3({0.0, 0.0, 0.0}), 0.1);
        f.update_heading(0.0, deg_to_rad(2.0));
    }
    // A 90 degree jump with a tight sigma is far outside the gate.
    BOOST_CHECK(!f.update_heading(deg_to_rad(90.0), deg_to_rad(2.0)));
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(wrap_pi(f.heading()))), 1.0);
}

BOOST_AUTO_TEST_CASE(non_finite_input_is_ignored)
{
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(0.0)), 0.0));
    const double before = f.heading();
    f.propagate(Vector3({std::nan(""), 0.0, 0.0}), 0.1);
    BOOST_CHECK(!f.update_gravity(Vector3({std::nan(""), 0.0, 9.81})));
    BOOST_CHECK(!f.update_heading(std::nan(""), 0.1));
    BOOST_CHECK_SMALL(wrap_pi(f.heading() - before), 1e-12);
}

BOOST_AUTO_TEST_CASE(long_gap_is_split_but_still_integrates)
{
    AttitudeFilter f;
    BOOST_REQUIRE(f.initialise(gravity_report(level_attitude(0.0)), 0.0));
    const double rate = deg_to_rad(5.0);
    f.propagate(Vector3({0.0, 0.0, -rate}), 4.0);
    BOOST_CHECK_CLOSE(rad_to_deg(f.heading()), 20.0, 0.5);
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(vertical_filter_tests)

BOOST_AUTO_TEST_CASE(first_measurement_initialises)
{
    VerticalFilter f;
    BOOST_CHECK(!f.initialised());
    BOOST_CHECK(f.update_depth(3.5, 0.1));
    BOOST_CHECK(f.initialised());
    BOOST_CHECK_CLOSE(f.depth(), 3.5, 1e-9);
}

BOOST_AUTO_TEST_CASE(tracks_a_constant_descent)
{
    VerticalFilter f;
    const double rate = 0.3;
    double depth = 0.0;
    f.update_depth(depth, 0.1);
    for (int i = 0; i < 400; ++i)
    {
        depth += rate * 0.1;
        f.propagate(0.1);
        f.update_depth(depth, 0.1);
    }
    BOOST_CHECK_CLOSE(f.depth(), depth, 2.0);
    BOOST_CHECK_CLOSE(f.depth_rate(), rate, 15.0);
}

BOOST_AUTO_TEST_CASE(outlier_is_gated_out)
{
    VerticalFilter f;
    f.update_depth(2.0, 0.1);
    for (int i = 0; i < 100; ++i)
    {
        f.propagate(0.1);
        f.update_depth(2.0, 0.1);
    }
    BOOST_CHECK(!f.update_depth(80.0, 0.1));
    BOOST_CHECK_CLOSE(f.depth(), 2.0, 5.0);
}

BOOST_AUTO_TEST_CASE(rejects_non_finite_depth)
{
    VerticalFilter f;
    BOOST_CHECK(!f.update_depth(std::nan(""), 0.1));
    BOOST_CHECK(!f.initialised());
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(dead_reckoner_tests)

BOOST_AUTO_TEST_CASE(uninitialised_does_not_move)
{
    DeadReckoner dr;
    BOOST_CHECK(!dr.initialised());
    dr.propagate({0.0, 0.0, 2000.0}, 1.0);
    BOOST_CHECK_SMALL(dr.position().norm(), 1e-12);
}

BOOST_AUTO_TEST_CASE(straight_line_propagation_is_kinematic)
{
    DeadReckonerConfig cfg;
    cfg.surge_time_constant = 1e-6; // reach the model speed immediately
    DeadReckoner dr(cfg);
    dr.reset_position(Vector2({0.0, 0.0}), 1.0);

    const double rpm = 2200.0;
    const double heading = deg_to_rad(90.0); // due east
    for (int i = 0; i < 100; ++i) dr.propagate({heading, 0.0, rpm}, 0.1);

    const double expected = ThrustModel().speed(rpm) * 10.0;
    BOOST_CHECK_CLOSE(dr.position()[0], expected, 2.0);
    BOOST_CHECK_SMALL(dr.position()[1], 0.5);
}

BOOST_AUTO_TEST_CASE(vertical_nose_credits_no_horizontal_motion_from_stale_surge)
{
    // Regression for finding 1 (depth-hold/nose-up physics): forward_horizontal_fraction must
    // scale the surge STATE's contribution to velocity, not just the relaxation target. Build
    // up real surge while level, then go nose-vertical with the propeller off but a long time
    // constant, so a stale surge would still be large if it were credited unscaled.
    DeadReckonerConfig cfg;
    cfg.surge_time_constant = 100.0;
    DeadReckoner dr(cfg);
    dr.reset_position(Vector2({0.0, 0.0}), 1.0);

    const double heading = 0.0; // due north
    for (int i = 0; i < 1500; ++i) dr.propagate({heading, 0.0, 2000.0, 1.0}, 0.1);
    BOOST_CHECK_GT(dr.surge(), 1.0);

    const Vector2 before = dr.position();
    for (int i = 0; i < 20; ++i) dr.propagate({heading, 0.0, 0.0, 0.0}, 0.1);
    BOOST_CHECK_SMALL((dr.position() - before)[1], 1e-9);
}

BOOST_AUTO_TEST_CASE(surge_relaxes_toward_the_thrust_model)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.0);
    const double rpm = 2000.0;
    for (int i = 0; i < 300; ++i) dr.propagate({0.0, 0.0, rpm}, 0.1);
    BOOST_CHECK_CLOSE(dr.surge(), ThrustModel().speed(rpm), 2.0);
}

BOOST_AUTO_TEST_CASE(position_update_pulls_toward_the_fix)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 20.0);
    BOOST_CHECK(dr.update_position(Vector2({10.0, 0.0}), 1.5));
    BOOST_CHECK_GT(dr.position()[0], 5.0);
}

BOOST_AUTO_TEST_CASE(position_outlier_is_gated_out)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.0);
    for (int i = 0; i < 50; ++i)
    {
        dr.propagate({0.0, 0.0, 0.0}, 0.2);
        dr.update_position(Vector2({0.0, 0.0}), 1.5);
    }
    BOOST_CHECK(!dr.update_position(Vector2({5000.0, 0.0}), 1.5));
    BOOST_CHECK_SMALL(dr.position().norm(), 5.0);
}

BOOST_AUTO_TEST_CASE(current_and_speed_scale_are_identified)
{
    // Drive a boxed pattern so heading changes make the current observable.
    const Vector2 truth_current({0.35, -0.20});
    const double truth_scale = 0.85;
    const double rpm = 2200.0;
    const ThrustModel thrust;
    const double truth_surge = truth_scale * thrust.speed(rpm);

    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);

    const double dt = 0.2;
    Vector2 truth_position({0.0, 0.0});
    for (int step = 0; step < 6000; ++step)
    {
        const double heading = deg_to_rad(90.0 * static_cast<double>((step / 500) % 4));
        const Vector2 velocity = heading_vector(heading) * truth_surge + truth_current;
        truth_position += velocity * dt;

        dr.propagate({heading, 0.0, rpm}, dt);
        dr.update_position(truth_position, 1.5);
        dr.update_ground_velocity(velocity, heading, 0.2);
    }

    BOOST_CHECK_SMALL(dr.current()[0] - truth_current[0], 0.08);
    BOOST_CHECK_SMALL(dr.current()[1] - truth_current[1], 0.08);
    BOOST_CHECK_SMALL(dr.speed_scale() - truth_scale, 0.06);
    BOOST_CHECK_SMALL((dr.position() - truth_position).norm(), 3.0);
}

BOOST_AUTO_TEST_CASE(heading_bias_is_identified)
{
    const double truth_bias = deg_to_rad(8.0);
    const double rpm = 2200.0;
    const double truth_surge = ThrustModel().speed(rpm);

    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);

    const double dt = 0.2;
    Vector2 truth_position({0.0, 0.0});
    for (int step = 0; step < 8000; ++step)
    {
        const double compass = deg_to_rad(90.0 * static_cast<double>((step / 500) % 4));
        const Vector2 velocity = heading_vector(compass + truth_bias) * truth_surge;
        truth_position += velocity * dt;

        dr.propagate({compass, 0.0, rpm}, dt);
        dr.update_position(truth_position, 1.5);
        dr.update_ground_velocity(velocity, compass, 0.2);
    }

    BOOST_CHECK_SMALL(rad_to_deg(dr.heading_bias() - truth_bias), 3.0);
}

BOOST_AUTO_TEST_CASE(speed_only_update_still_constrains_surge)
{
    const double rpm = 2200.0;
    const double truth_surge = 0.7 * ThrustModel().speed(rpm);

    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);
    for (int step = 0; step < 4000; ++step)
    {
        const double heading = deg_to_rad(90.0 * static_cast<double>((step / 400) % 4));
        dr.propagate({heading, 0.0, rpm}, 0.2);
        dr.update_speed_only(truth_surge, heading, 0.2);
    }
    BOOST_CHECK_SMALL(dr.speed_over_ground(0.0) - truth_surge, 0.25);
}

BOOST_AUTO_TEST_CASE(calibration_stays_within_bounds)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);
    // Feed a wildly inconsistent speed and confirm the states stay physical.
    for (int step = 0; step < 3000; ++step)
    {
        dr.propagate({0.0, 0.0, 2000.0}, 0.2);
        dr.update_speed_only(40.0, 0.0, 1.0);
    }
    BOOST_CHECK_LE(dr.speed_scale(), dr.config().max_speed_scale + 1e-9);
    BOOST_CHECK_GE(dr.speed_scale(), dr.config().min_speed_scale - 1e-9);
    BOOST_CHECK_LE(dr.current().norm(), dr.config().max_current * std::sqrt(2.0) + 1e-9);
    BOOST_CHECK_LE(std::abs(dr.heading_bias()), dr.config().max_heading_bias + 1e-9);
}

BOOST_AUTO_TEST_CASE(course_over_ground_is_absent_at_rest)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);
    BOOST_CHECK(!dr.course_over_ground(0.0).has_value());

    for (int i = 0; i < 300; ++i) dr.propagate({deg_to_rad(45.0), 0.0, 2200.0}, 0.2);
    const auto cog = dr.course_over_ground(deg_to_rad(45.0));
    BOOST_REQUIRE(cog.has_value());
    BOOST_CHECK_CLOSE(rad_to_deg(*cog), 45.0, 2.0);
}

BOOST_AUTO_TEST_CASE(position_sigma_grows_while_coasting)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);
    const double initial = dr.position_sigma();
    for (int i = 0; i < 500; ++i) dr.propagate({0.0, deg_to_rad(5.0) * deg_to_rad(5.0), 2200.0}, 0.2);
    BOOST_CHECK_GT(dr.position_sigma(), initial);
}

// The reporting covariance inflates current/speed-scale process noise to reflect measured
// real-world unpredictability (H3), but must never feed back into the state estimate: it is
// tracked entirely separately from the covariance that drives the Kalman gain.

BOOST_AUTO_TEST_CASE(report_sigma_never_understates_the_state_sigma)
{
    DeadReckoner dr;
    dr.reset_position(Vector2({0.0, 0.0}), 1.5);
    BOOST_CHECK_GE(dr.position_sigma(), dr.position_sigma_internal());
    for (int i = 0; i < 2000; ++i)
    {
        dr.propagate({deg_to_rad(37.0), 0.0, 2200.0}, 0.2);
        if (i % 5 == 0) dr.update_position(Vector2({0.1 * i, -0.05 * i}), 1.5);
        BOOST_CHECK_GE(dr.position_sigma(), dr.position_sigma_internal());
    }
    // While coasting the two must actually diverge, not just tie, or the report-only
    // inflation configured via report_current_random_walk/report_speed_scale_random_walk
    // is not doing anything.
    for (int i = 0; i < 500; ++i) dr.propagate({deg_to_rad(37.0), 0.0, 2200.0}, 0.2);
    BOOST_CHECK_GT(dr.position_sigma(), 1.5 * dr.position_sigma_internal());
}

BOOST_AUTO_TEST_CASE(report_noise_does_not_change_the_state_estimate)
{
    // Two filters differing only in the report-only noise config must produce byte-for-byte
    // identical state trajectories: report noise must never influence the Kalman gain, x, or
    // the state-driving covariance, only `position_sigma()`.
    DeadReckonerConfig quiet_report;
    quiet_report.report_current_random_walk = 1e-6;
    quiet_report.report_speed_scale_random_walk = 1e-6;
    DeadReckonerConfig loud_report;
    loud_report.report_current_random_walk = 1.0;
    loud_report.report_speed_scale_random_walk = 1.0;

    DeadReckoner quiet(quiet_report);
    DeadReckoner loud(loud_report);
    quiet.reset_position(Vector2({0.0, 0.0}), 1.5);
    loud.reset_position(Vector2({0.0, 0.0}), 1.5);

    for (int i = 0; i < 1000; ++i)
    {
        const DeadReckoner::Input input{deg_to_rad(20.0), deg_to_rad(2.0), 2200.0, 1.0};
        quiet.propagate(input, 0.2);
        loud.propagate(input, 0.2);
        if (i % 5 == 0)
        {
            const Vector2 fix({0.1 * i, 0.05 * i});
            quiet.update_position(fix, 1.5);
            loud.update_position(fix, 1.5);
            quiet.update_speed_only(0.8, deg_to_rad(20.0), 0.2);
            loud.update_speed_only(0.8, deg_to_rad(20.0), 0.2);
        }
    }

    BOOST_CHECK_SMALL((quiet.position() - loud.position()).norm(), 1e-9);
    BOOST_CHECK_SMALL(quiet.surge() - loud.surge(), 1e-9);
    BOOST_CHECK_SMALL((quiet.current() - loud.current()).norm(), 1e-9);
    BOOST_CHECK_SMALL(quiet.speed_scale() - loud.speed_scale(), 1e-9);
    BOOST_CHECK_SMALL(quiet.position_sigma_internal() - loud.position_sigma_internal(), 1e-9);
    // But the honest, reported sigma differs enormously between the two configs.
    BOOST_CHECK_GT(loud.position_sigma(), 10.0 * quiet.position_sigma());
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_AUTO_TEST_SUITE(state_estimator_integration_tests)

namespace
{
/// Closed-loop truth model: constant surge through water plus a constant current, steering a
/// box pattern at a finite turn rate. Feeds the estimator the messages the bot publishes,
/// including a gyro consistent with the turn.
struct Scenario
{
    double declination{deg_to_rad(-13.5)};
    double origin_lat{41.6576};
    double origin_lon{-71.2721};
    double rpm{2200.0};
    double speed_scale{0.9};
    Vector2 current{Vector2({0.25, -0.15})};
    double gnss_position_noise{1.5};
    double gnss_speed_noise{0.15};
    double heading_noise{deg_to_rad(4.0)};
    double gyro_bias{deg_to_rad(0.3)};
    double max_turn_rate{deg_to_rad(15.0)};
    double leg_duration{120.0};
    double duration{600.0};
    /// GNSS is withheld from this time onward.
    double gnss_denied_from{std::numeric_limits<double>::infinity()};
    /// Emit magnetic_field instead of relying on the rotation vector.
    bool publish_magnetometer{false};

    double target_heading_at(double t) const
    {
        return deg_to_rad(90.0 * static_cast<double>(static_cast<int>(t / leg_duration) % 4));
    }
};

struct Outcome
{
    double final_error{0.0};
    double distance_travelled{0.0};
    double distance_while_denied{0.0};
    double max_error_while_aided{0.0};
    NavSolution solution;
};

Outcome run(const Scenario& sc, unsigned seed = 42)
{
    std::mt19937 rng(seed);
    std::normal_distribution<double> gauss(0.0, 1.0);

    StateEstimatorConfig cfg;
    cfg.declination = sc.declination;
    cfg.prefer_magnetometer = sc.publish_magnetometer;
    StateEstimator est(cfg);
    est.set_origin(sc.origin_lat, sc.origin_lon);
    const LocalTangentPlane plane(sc.origin_lat, sc.origin_lon);

    const double surge = sc.speed_scale * ThrustModel().speed(sc.rpm);
    const double dt = 0.1;

    Vector2 truth({0.0, 0.0});
    double heading = 0.0;
    Outcome out;

    for (int step = 0; static_cast<double>(step) * dt < sc.duration; ++step)
    {
        const double t = static_cast<double>(step) * dt;
        const double turn_rate = std::clamp(wrap_pi(sc.target_heading_at(t) - heading) / dt,
                                            -sc.max_turn_rate, sc.max_turn_rate);
        heading = wrap_two_pi(heading + turn_rate * dt);

        const Vector2 velocity = heading_vector(heading) * surge + sc.current;
        truth += velocity * dt;
        const double leg = velocity.norm() * dt;
        out.distance_travelled += leg;
        const bool denied = t >= sc.gnss_denied_from;
        if (denied) out.distance_while_denied += leg;

        // IMU at 10 Hz, referenced to magnetic north as the BNO08x reports it.
        const double magnetic_heading =
            wrap_two_pi(heading - sc.declination + sc.heading_noise * gauss(rng));
        ImuSample imu;
        imu.time = t;
        imu.gravity = gravity_report(level_attitude(heading));
        imu.angular_velocity = Vector3({0.0, 0.0, -turn_rate + sc.gyro_bias});
        imu.magnetometer_accuracy = 3;
        if (sc.publish_magnetometer)
        {
            // Field pointing at magnetic north, dipping downward.
            imu.magnetic_field =
                level_attitude(magnetic_heading).rotate_inverse(Vector3({0.0, 20.0, -45.0}));
            imu.quaternion = level_attitude(magnetic_heading);
        }
        else
        {
            imu.quaternion = level_attitude(magnetic_heading);
        }
        est.handle_imu(imu);

        if (step % 2 == 0)
        {
            est.handle_motor(MotorSample{t, sc.rpm});
            if (!denied)
            {
                const Vector2 noisy({truth[0] + sc.gnss_position_noise * gauss(rng),
                                     truth[1] + sc.gnss_position_noise * gauss(rng)});
                const Vector2 geo = plane.to_geographic(noisy);
                GnssSample g;
                g.time = t;
                g.lat = geo[0];
                g.lon = geo[1];
                g.mode = 3;
                g.speed_over_ground = velocity.norm() + sc.gnss_speed_noise * gauss(rng);
                g.course_over_ground = wrap_two_pi(std::atan2(velocity[0], velocity[1]));
                est.handle_gnss(g);
            }
        }

        est.advance_to(t);
        const NavSolution s = est.solution();
        if (s.position_valid && s.mode == NavMode::gnss_aided)
            out.max_error_while_aided =
                std::max(out.max_error_while_aided, (s.position_east_north - truth).norm());
    }

    est.advance_to(sc.duration);
    out.solution = est.solution();
    out.final_error = (out.solution.position_east_north - truth).norm();
    return out;
}

} // namespace

BOOST_AUTO_TEST_CASE(tracks_truth_while_gnss_is_available)
{
    const Outcome out = run(Scenario{});
    BOOST_CHECK_EQUAL(static_cast<int>(out.solution.mode), static_cast<int>(NavMode::gnss_aided));
    BOOST_CHECK_LT(out.final_error, 3.0);
    BOOST_CHECK_LT(out.max_error_while_aided, 8.0);
}

BOOST_AUTO_TEST_CASE(dead_reckons_far_better_than_freezing)
{
    // Ten minutes of aiding to calibrate, then five minutes with no GNSS at all.
    Scenario sc;
    sc.duration = 900.0;
    sc.gnss_denied_from = 600.0;

    const Outcome out = run(sc);
    BOOST_CHECK_EQUAL(static_cast<int>(out.solution.mode),
                      static_cast<int>(NavMode::dead_reckoning));

    // Freezing at the last fix, as the current stack does, would accrue the whole distance
    // travelled during the outage as error.
    BOOST_CHECK_GT(out.distance_while_denied, 300.0);
    BOOST_TEST_MESSAGE("outage drift " << out.final_error << " m over "
                                       << out.distance_while_denied << " m travelled ("
                                       << 100.0 * out.final_error / out.distance_while_denied
                                       << "%)");
    BOOST_CHECK_LT(out.final_error, 0.15 * out.distance_while_denied);
    // The reported uncertainty must not badly understate the actual error. This scenario's
    // current is exactly the modelled random-walk mean, so the filter fits it almost
    // perfectly and `final_error` ends up tiny; the report-only inflation calibrated against
    // real fleet current mismatch (see `report_current_random_walk`) then makes sigma look
    // very conservative here. That is expected, not a bug: the fleet-realistic calibration
    // check lives in nav_replay/analysis, not this idealised closed-loop scenario.
    BOOST_CHECK_GT(out.solution.position_sigma, out.final_error);
}

BOOST_AUTO_TEST_CASE(dead_reckoning_drift_is_repeatable_across_seeds)
{
    Scenario sc;
    sc.duration = 900.0;
    sc.gnss_denied_from = 600.0;
    for (unsigned seed : {1u, 7u, 13u, 99u})
    {
        const Outcome out = run(sc, seed);
        BOOST_TEST_MESSAGE("seed " << seed << " drift " << out.final_error << " m");
        BOOST_CHECK_LT(out.final_error, 0.15 * out.distance_while_denied);
    }
}

BOOST_AUTO_TEST_CASE(current_and_speed_scale_are_recovered_from_gnss)
{
    Scenario sc;
    sc.duration = 900.0;
    sc.gnss_position_noise = 0.0;
    sc.gnss_speed_noise = 0.0;
    sc.heading_noise = 0.0;

    const NavSolution s = run(sc).solution;
    BOOST_CHECK_SMALL(s.current_east_north[0] - sc.current[0], 0.10);
    BOOST_CHECK_SMALL(s.current_east_north[1] - sc.current[1], 0.10);
    BOOST_CHECK_SMALL(s.speed_scale - sc.speed_scale, 0.10);
}

BOOST_AUTO_TEST_CASE(works_without_magnetometer_or_raw_accel)
{
    // Matches the deployed fleet firmware, which publishes neither field.
    Scenario sc;
    sc.duration = 400.0;
    sc.publish_magnetometer = false;
    const Outcome out = run(sc);
    BOOST_CHECK(out.solution.mode == NavMode::gnss_aided);
    BOOST_CHECK_LT(out.final_error, 5.0);
}

BOOST_AUTO_TEST_CASE(magnetometer_path_works_when_the_field_is_published)
{
    Scenario sc;
    sc.duration = 400.0;
    sc.publish_magnetometer = true;
    const Outcome out = run(sc);
    BOOST_CHECK(out.solution.mode == NavMode::gnss_aided);
    BOOST_CHECK_LT(out.final_error, 5.0);
}

BOOST_AUTO_TEST_CASE(gyro_bias_is_absorbed_during_a_long_outage)
{
    // A 1 deg/s gyro offset would swing heading by 300 deg over a five minute coast if the
    // filter did not identify it.
    Scenario sc;
    sc.duration = 900.0;
    sc.gnss_denied_from = 600.0;
    sc.gyro_bias = deg_to_rad(1.0);
    const Outcome out = run(sc);
    BOOST_TEST_MESSAGE("drift with 1 deg/s gyro bias: " << out.final_error << " m over "
                                                        << out.distance_while_denied << " m");
    BOOST_CHECK_LT(out.final_error, 0.20 * out.distance_while_denied);
}

BOOST_AUTO_TEST_CASE(no_fix_samples_do_not_seed_position)
{
    StateEstimator est;
    GnssSample g;
    g.time = 1.0;
    g.lat = 41.0;
    g.lon = -71.0;
    g.mode = 1; // no fix
    est.handle_gnss(g);
    BOOST_CHECK(!est.solution().position_valid);
    BOOST_CHECK(!est.tangent_plane().valid());
}

BOOST_AUTO_TEST_CASE(out_of_order_samples_are_dropped)
{
    StateEstimator est;
    ImuSample a;
    a.time = 10.0;
    a.quaternion = level_attitude(0.0);
    a.gravity = gravity_report(level_attitude(0.0));
    a.angular_velocity = Vector3({0.0, 0.0, 0.0});
    est.handle_imu(a);

    ImuSample stale = a;
    stale.time = 9.0;
    stale.quaternion = level_attitude(deg_to_rad(90.0));
    est.handle_imu(stale);

    BOOST_CHECK_SMALL(std::abs(wrap_pi(est.solution().heading)), deg_to_rad(5.0));
}

BOOST_AUTO_TEST_CASE(garbage_input_is_ignored)
{
    StateEstimator est;
    ImuSample bad;
    bad.time = std::nan("");
    est.handle_imu(bad);

    GnssSample g;
    g.time = 1.0;
    g.lat = 1000.0;
    g.lon = -71.0;
    g.mode = 3;
    est.handle_gnss(g);

    est.handle_pressure(PressureSample{std::nan(""), 1.0});
    est.handle_motor(MotorSample{1.0, std::nan("")});

    const NavSolution s = est.solution();
    BOOST_CHECK(!s.position_valid);
    BOOST_CHECK(s.mode == NavMode::uninitialised);
}

BOOST_AUTO_TEST_CASE(gnss_velocity_update_is_skipped_while_nose_is_too_steep)
{
    // Regression for finding 1: 14.4% of speed-usable GNSS fixes fleet-wide arrive while pitch
    // exceeds max_heading_update_pitch (up to 26% on some logs), the same threshold that already
    // gates heading corrections. update_speed_and_course/update_speed_only decompose velocity
    // into surge (along heading) plus current, so applying them with an unobservable heading
    // corrupts surge/current/heading_bias with a residual that has nothing to do with thrust.
    const Quaternion steep = level_attitude(0.0) * exp_map(Vector3({0.0, deg_to_rad(-88.0), 0.0}));

    StateEstimator est;
    est.set_origin(0.0, 0.0);
    const LocalTangentPlane plane(0.0, 0.0);

    ImuSample imu;
    imu.time = 0.0;
    imu.quaternion = steep;
    imu.gravity = gravity_report(steep);
    est.handle_imu(imu);
    BOOST_CHECK(!est.attitude().heading_observable());

    // First fix seeds position without going through update_position/update_speed_*.
    GnssSample g0;
    g0.time = 0.0;
    g0.lat = 0.0;
    g0.lon = 0.0;
    g0.mode = 3;
    g0.speed_over_ground = 1.0;
    g0.course_over_ground = 0.0;
    est.handle_gnss(g0);
    est.advance_to(0.0);
    const auto before = est.diagnostics();
    BOOST_CHECK_EQUAL(before.velocity_accepted + before.velocity_rejected, 0);
    BOOST_CHECK_EQUAL(before.speed_accepted + before.speed_rejected, 0);

    ImuSample imu1;
    imu1.time = 1.0;
    imu1.quaternion = steep;
    imu1.gravity = gravity_report(steep);
    est.handle_imu(imu1);

    GnssSample g1;
    g1.time = 1.0;
    const Vector2 geo = plane.to_geographic(Vector2({0.0, 1.0}));
    g1.lat = geo[0];
    g1.lon = geo[1];
    g1.mode = 3;
    g1.speed_over_ground = 1.0;
    g1.course_over_ground = 0.0;
    est.handle_gnss(g1);
    est.advance_to(1.0);

    const auto after = est.diagnostics();
    BOOST_CHECK_EQUAL(after.velocity_accepted + after.velocity_rejected,
                      before.velocity_accepted + before.velocity_rejected);
    BOOST_CHECK_EQUAL(after.speed_accepted + after.speed_rejected,
                      before.speed_accepted + before.speed_rejected);
    BOOST_CHECK_GT(after.position_accepted, before.position_accepted);
}

BOOST_AUTO_TEST_CASE(depth_flows_through_to_the_solution)
{
    StateEstimator est;
    for (int i = 0; i < 50; ++i) est.handle_pressure(PressureSample{0.1 * i, 4.0});
    BOOST_CHECK_CLOSE(est.solution().depth, 4.0, 5.0);
}

BOOST_AUTO_TEST_CASE(mode_reports_dead_reckoning_after_the_timeout)
{
    Scenario sc;
    sc.duration = 300.0;
    sc.gnss_denied_from = 200.0;
    const Outcome out = run(sc);
    BOOST_CHECK_EQUAL(static_cast<int>(out.solution.mode),
                      static_cast<int>(NavMode::dead_reckoning));
}

BOOST_AUTO_TEST_CASE(long_imu_gap_reinitialises_attitude)
{
    StateEstimator est;
    ImuSample s;
    s.time = 0.0;
    s.quaternion = level_attitude(0.0);
    s.gravity = gravity_report(level_attitude(0.0));
    s.angular_velocity = Vector3({0.0, 0.0, 0.0});
    est.handle_imu(s);
    BOOST_CHECK(est.solution().attitude_valid);

    // A 60 s dropout, then the bot reappears pointing somewhere else entirely.
    const double heading = deg_to_rad(200.0);
    s.time = 60.0;
    s.quaternion = level_attitude(heading);
    s.gravity = gravity_report(level_attitude(heading));
    est.handle_imu(s);

    s.time = 60.1;
    est.handle_imu(s);
    BOOST_CHECK_SMALL(rad_to_deg(std::abs(wrap_pi(est.solution().heading - heading))), 5.0);
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace nav
} // namespace jaiabot

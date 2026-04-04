// Copyright 2026:
//   JaiaRobotics LLC
//
// Route mission plan waypoints around exclusion zones by inserting bypass
// waypoints for any path segment that intersects a zone polygon.

#ifndef EXCLUSION_ZONE_ROUTER_H
#define EXCLUSION_ZONE_ROUTER_H

#include <algorithm>
#include <cmath>
#include <vector>

#include <goby/util/geodesy.h>
#include <goby/util/debug_logger.h>

#include "jaiabot/messages/exclusion_zone.pb.h"
#include "jaiabot/messages/mission.pb.h"

namespace jaiabot
{
namespace mission_routing
{

struct XYPt
{
    double x, y;
};

// Cross product of vectors O→A and O→B.
inline double cross(const XYPt& O, const XYPt& A, const XYPt& B)
{
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

// Andrew's monotone chain — returns CCW convex hull. Returns empty if < 3
// non-collinear points.
inline std::vector<XYPt> convex_hull(std::vector<XYPt> pts)
{
    int n = (int)pts.size();
    if (n < 3)
        return {};
    std::sort(pts.begin(), pts.end(),
              [](const XYPt& a, const XYPt& b) {
                  return a.x < b.x || (a.x == b.x && a.y < b.y);
              });
    std::vector<XYPt> hull;
    // Lower hull
    for (const auto& p : pts)
    {
        while (hull.size() >= 2 &&
               cross(hull[hull.size() - 2], hull[hull.size() - 1], p) <= 0)
            hull.pop_back();
        hull.push_back(p);
    }
    // Upper hull
    size_t lower_size = hull.size();
    for (int i = n - 2; i >= 0; --i)
    {
        while (hull.size() > lower_size &&
               cross(hull[hull.size() - 2], hull[hull.size() - 1], pts[i]) <= 0)
            hull.pop_back();
        hull.push_back(pts[i]);
    }
    hull.pop_back(); // last == first
    if (hull.size() < 3)
        return {};
    return hull;
}

// Returns true if segments AB and CD properly intersect (endpoint-touching is
// not counted as intersection to avoid false positives when a waypoint sits on
// a zone boundary).
inline bool segments_intersect(XYPt A, XYPt B, XYPt C, XYPt D)
{
    double d1 = cross(C, D, A);
    double d2 = cross(C, D, B);
    double d3 = cross(A, B, C);
    double d4 = cross(A, B, D);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
        return true;
    return false;
}

// Returns true if P is strictly inside the convex polygon (CCW vertices).
// Uses the cross-product sign test: P is inside iff cross(V_i, V_{i+1}, P) > 0
// for all edges.
inline bool point_in_polygon(XYPt P, const std::vector<XYPt>& poly)
{
    int n = (int)poly.size();
    for (int i = 0; i < n; ++i)
    {
        const XYPt& a = poly[i];
        const XYPt& b = poly[(i + 1) % n];
        if (cross(a, b, P) < 0)
            return false;
    }
    return true;
}

// Returns true if segment AB intersects the polygon interior: either an
// endpoint is inside, or the segment crosses a polygon edge.
inline bool segment_intersects_polygon(XYPt A, XYPt B, const std::vector<XYPt>& poly)
{
    if (point_in_polygon(A, poly) || point_in_polygon(B, poly))
        return true;
    int n = (int)poly.size();
    for (int i = 0; i < n; ++i)
    {
        if (segments_intersect(A, B, poly[i], poly[(i + 1) % n]))
            return true;
    }
    return false;
}

// Expands a convex polygon by pushing each vertex outward from the centroid by
// safety_margin metres.
inline std::vector<XYPt> expand_polygon(const std::vector<XYPt>& poly, double safety_margin)
{
    if (poly.empty())
        return poly;
    double cx = 0, cy = 0;
    for (const auto& v : poly) { cx += v.x; cy += v.y; }
    cx /= poly.size();
    cy /= poly.size();

    std::vector<XYPt> expanded;
    expanded.reserve(poly.size());
    for (const auto& v : poly)
    {
        double dx = v.x - cx, dy = v.y - cy;
        double dist = std::sqrt(dx * dx + dy * dy);
        if (dist < 1e-6)
        {
            expanded.push_back(v);
            continue;
        }
        expanded.push_back({cx + dx * (dist + safety_margin) / dist,
                            cy + dy * (dist + safety_margin) / dist});
    }
    return expanded;
}

inline double dist_sq(XYPt A, XYPt B)
{
    double dx = A.x - B.x, dy = A.y - B.y;
    return dx * dx + dy * dy;
}

// Route waypoints around exclusion zones.
//
// For each segment goal[i]→goal[i+1] that intersects a zone (buffered by
// safety_margin), inserts a single bypass waypoint at the best vertex of the
// expanded polygon. Iterates until no intersections remain (up to
// max_iterations). Inserted goals have name="route_bypass" and no task.
//
// The temporary geodesy is constructed from the plan's datum origin using the
// same logic as MissionManagerStateMachine::set_mission_plan().
inline jaiabot::protobuf::MissionPlan
route_around_exclusion_zones(jaiabot::protobuf::MissionPlan plan,
                             const jaiabot::protobuf::ExclusionZones& zones,
                             double safety_margin = 15.0,
                             int max_iterations   = 10)
{
    using goby::glog;

    if (zones.zone_size() == 0 || plan.goal_size() < 2)
        return plan;

    // Build temporary geodesy — same datum logic as set_mission_plan().
    auto lat_origin = plan.recovery().recover_at_final_goal()
                          ? plan.goal(0).location().lat_with_units()
                          : plan.recovery().location().lat_with_units();
    auto lon_origin = plan.recovery().recover_at_final_goal()
                          ? plan.goal(0).location().lon_with_units()
                          : plan.recovery().location().lon_with_units();
    goby::util::UTMGeodesy geodesy({lat_origin, lon_origin});

    auto to_xy = [&](const jaiabot::protobuf::GeographicCoordinate& loc) -> XYPt {
        auto xy = geodesy.convert({loc.lat_with_units(), loc.lon_with_units()});
        return {xy.x.value(), xy.y.value()};
    };

    auto to_latlon =
        [&](XYPt pt) -> std::pair<double, double> {
        auto ll = geodesy.convert(
            {pt.x * boost::units::si::meters, pt.y * boost::units::si::meters});
        return {ll.lat.value(), ll.lon.value()};
    };

    // Pre-compute convex hulls for all zones.
    struct ZoneGeom
    {
        std::vector<XYPt> hull;     // original (for validity checks)
        std::vector<XYPt> expanded; // buffered (for intersection test)
    };
    std::vector<ZoneGeom> zone_geoms;
    for (int z = 0; z < zones.zone_size(); ++z)
    {
        const auto& zone = zones.zone(z);
        std::vector<XYPt> pts;
        pts.reserve(zone.vertices_size());
        for (int v = 0; v < zone.vertices_size(); ++v)
        {
            pts.push_back(to_xy(zone.vertices(v)));
        }
        auto hull = convex_hull(pts);
        if (hull.size() < 3)
            continue;
        zone_geoms.push_back({hull, expand_polygon(hull, safety_margin)});
    }

    if (zone_geoms.empty())
        return plan;

    int original_goal_count = plan.goal_size();

    for (int iter = 0; iter < max_iterations; ++iter)
    {
        bool changed = false;

        // Rebuild the goal list, inserting bypass waypoints as needed.
        std::vector<jaiabot::protobuf::MissionPlan::Goal> new_goals;
        new_goals.reserve(plan.goal_size() + (int)zone_geoms.size());

        for (int i = 0; i < plan.goal_size() - 1; ++i)
        {
            new_goals.push_back(plan.goal(i));

            XYPt A = to_xy(plan.goal(i).location());
            XYPt B = to_xy(plan.goal(i + 1).location());

            XYPt best_bypass{};
            bool found_bypass   = false;
            double best_cost    = 1e18;
            bool segment_blocked = false;

            for (const auto& zg : zone_geoms)
            {
                if (!segment_intersects_polygon(A, B, zg.expanded))
                    continue;

                segment_blocked = true;

                // Try each vertex of the expanded polygon as a bypass candidate.
                for (const auto& v : zg.expanded)
                {
                    // v must not be inside any original zone.
                    bool v_ok = true;
                    for (const auto& zg2 : zone_geoms)
                    {
                        if (point_in_polygon(v, zg2.hull))
                        {
                            v_ok = false;
                            break;
                        }
                    }
                    if (!v_ok)
                        continue;

                    // A→v and v→B must not cross the original zone hull.
                    if (segment_intersects_polygon(A, v, zg.hull))
                        continue;
                    if (segment_intersects_polygon(v, B, zg.hull))
                        continue;

                    double cost = std::sqrt(dist_sq(A, v)) + std::sqrt(dist_sq(v, B));
                    if (cost < best_cost)
                    {
                        best_cost   = cost;
                        best_bypass = v;
                        found_bypass = true;
                    }
                }
            }

            if (found_bypass)
            {
                auto [lat, lon] = to_latlon(best_bypass);
                jaiabot::protobuf::MissionPlan::Goal bypass_goal;
                bypass_goal.mutable_location()->set_lat_with_units(
                    lat * boost::units::degree::degrees);
                bypass_goal.mutable_location()->set_lon_with_units(
                    lon * boost::units::degree::degrees);
                bypass_goal.set_name("route_bypass");
                new_goals.push_back(bypass_goal);
                changed = true;

                glog.is_debug2() && glog << "Inserted bypass waypoint between goal " << i
                                         << " and " << (i + 1) << " at (" << lat << ", " << lon
                                         << ")" << std::endl;
            }
            else if (segment_blocked)
            {
                glog.is_warn() && glog << "Cannot route around exclusion zone on segment "
                                       << i << "→" << (i + 1)
                                       << "; waypoint may be inside a zone" << std::endl;
            }
        }
        new_goals.push_back(plan.goal(plan.goal_size() - 1));

        // Replace plan goals.
        plan.clear_goal();
        for (const auto& g : new_goals)
            *plan.add_goal() = g;

        if (!changed)
            break;

        // Safety cap to prevent unbounded expansion.
        if (plan.goal_size() > 50)
        {
            glog.is_warn() && glog << "Route planning goal cap reached (50); stopping"
                                   << std::endl;
            break;
        }
    }

    if (plan.goal_size() != original_goal_count)
        glog.is_debug1() && glog << "Route around exclusion zones: " << original_goal_count
                                 << " goals → " << plan.goal_size() << " goals" << std::endl;

    return plan;
}

} // namespace mission_routing
} // namespace jaiabot

#endif // EXCLUSION_ZONE_ROUTER_H

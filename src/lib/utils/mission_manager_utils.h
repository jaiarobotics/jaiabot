#ifndef JAIABOT_UTILS_MISSION_MANAGER_UTILS_H
#define JAIABOT_UTILS_MISSION_MANAGER_UTILS_H

#include <cmath>
#include <goby/util/geodesy.h>
#include "jaiabot/messages/geographic_coordinate.pb.h"

namespace jaiabot
{
namespace utils
{

struct PolarCoordinate
{
    double radius;
    double heading;
};

// Calculate new geographic position from a starting point, distance, and heading
// distance: meters, heading: compass degrees (0=North)
inline jaiabot::protobuf::GeographicCoordinate calculate_position_from_offset(
    const goby::util::UTMGeodesy& geodesy,
    const jaiabot::protobuf::GeographicCoordinate& start_location,
    double distance_meters, 
    double heading_degrees)
{
    // Convert start position to Cartesian
    auto start_xy = geodesy.convert({start_location.lat_with_units(), start_location.lon_with_units()});
    
    // Convert heading to math angle (0=East, 90=North, counterclockwise)
    double math_angle = 90.0 - heading_degrees;
    if (math_angle < 0) math_angle += 360.0;
    double angle_radians = math_angle * M_PI / 180.0;
    
    // Calculate offset in meters
    double dx = distance_meters * std::cos(angle_radians);
    double dy = distance_meters * std::sin(angle_radians);
    
    // Add offset to start position
    auto end_xy = goby::util::UTMGeodesy::XYPoint{
        start_xy.x + dx * boost::units::si::meters,
        start_xy.y + dy * boost::units::si::meters
    };
    
    // Convert back to lat/lon
    auto end_latlon = geodesy.convert(end_xy);
    
    jaiabot::protobuf::GeographicCoordinate result;
    result.set_lat_with_units(end_latlon.lat);
    result.set_lon_with_units(end_latlon.lon);
    
    return result;
}

// Converts a cartesian coordinate (x, y) to a polar coordinate (r, θ)
// Output: heading in compass degrees (0° = North)
inline PolarCoordinate convert_cartesian_to_polar(double start_x, double start_y, double end_x, double end_y)
{
    double delta_x = end_x - start_x;
    double delta_y = end_y - start_y;

    double radius = std::sqrt(delta_x * delta_x + delta_y * delta_y);
    
    // atan2(dy, dx) returns math angle in radians from -π to π (-180° to 180°)
    // Math angle: 0° = East, 90° = North (counterclockwise from positive X-axis)
    // Convert to compass heading: 0° = North, 90° = East (clockwise from North)
    double math_angle = std::atan2(delta_y, delta_x) * 180.0 / M_PI;
    double compass_heading = 90.0 - math_angle;
    if (compass_heading < 0)
    {
        compass_heading += 360.0;
    }
    
    PolarCoordinate polar_coordinate;
    polar_coordinate.radius = radius;
    polar_coordinate.heading = compass_heading;
    
    return polar_coordinate;
}

// Calculate where the dive ended by going backwards from where drift started
// This accounts for the drift that happened during GPS reacquisition
inline jaiabot::protobuf::GeographicCoordinate find_dive_end_location(
    const goby::util::UTMGeodesy& geodesy,
    double duration_to_acquire_gps, 
    const jaiabot::protobuf::GeographicCoordinate& drift_start_location, 
    double drift_speed, 
    double drift_heading)
{
    double gps_acquire_distance = duration_to_acquire_gps * drift_speed;

    // Get opposite heading (where we drifted FROM, not where we drifted TO)
    double opposite_heading = std::fmod(drift_heading + 180.0, 360.0);
    
    return calculate_position_from_offset(geodesy, drift_start_location, gps_acquire_distance, opposite_heading);
}

// Function from GeeksForGeeks: https://www.geeksforgeeks.org/dsa/haversine-formula-to-find-distance-between-two-points-on-a-sphere/
inline float haversine(float lat1, float lon1,
    float lat2, float lon2)
{
    // distance between latitudes
    // and longitudes
    float dLat = (lat2 - lat1) *
    M_PI / 180.0;
    float dLon = (lon2 - lon1) * 
    M_PI / 180.0;

    // convert to radians
    float lat1_rad = (lat1) * M_PI / 180.0;
    float lat2_rad = (lat2) * M_PI / 180.0;

    // apply formulae
    float a = pow(sin(dLat / 2), 2) + 
    pow(sin(dLon / 2), 2) * 
    cos(lat1_rad) * cos(lat2_rad);
    float rad = 6371.0;
    float c = 2 * asin(sqrt(a));

    return rad * c * 1000.0; // Convert to meters
}

inline float calculateHeading(double sx, double sy, double ex, double ey) {    
    auto dx = ex - sx, dy = ey - sy;
    
    // atan2(dy, dx) returns math angle in radians from -π to π (-180° to 180°)
    // Math angle: 0° = East, 90° = North (counterclockwise from positive X-axis)
    // Convert to compass heading: 0° = North, 90° = East (clockwise from North)
    double math_angle_rad = std::atan2(dy, dx);
    double heading_rad = M_PI / 2.0 - math_angle_rad;
    
    if (heading_rad < 0)
        heading_rad = heading_rad + (2.0 * M_PI);
    
    // Convert to degrees
    return heading_rad * 180.0 / M_PI;
}

} // namespace utils
} // namespace jaiabot

#endif // JAIABOT_UTILS_MISSION_MANAGER_UTILS_H
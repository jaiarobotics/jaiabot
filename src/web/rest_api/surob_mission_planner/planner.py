"""
JaiaBot Surfzone Mission Planning Tool

This module provides functions to plan cross-shore surfzone missions for jaiabot swarms.
The mission consists of measurements (station keeping + dive) distributed along a single
cross-shore transect from shoreline to offshore extent.

Author(s): 
- Spicer Bak     (Spicer.Bak@usace.army.mil)
- Matthew Saenz  (Matthew.J.Saenz@usace.army.mil)
Date: 2026-01-21
"""

import json
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np


@dataclass
class MissionParameters:
    """Input parameters for mission planning"""

    shoreline_lat: float  # Latitude of shoreline point
    shoreline_lon: float  # Longitude of shoreline point
    offshore_lat: float  # Latitude of offshore extent point
    offshore_lon: float  # Longitude of offshore extent point
    num_bots: int  # Number of bots available
    measurement_time: float  # Time for one measurement (station keep + dive) in minutes
    mission_duration: float = None  # Desired total mission duration in minutes (optional)
    target_resolution: float = None  # Target spatial resolution in meters (optional)
    dive_depth: float = 50.0  # Maximum dive depth in meters (bottom dive default)
    transit_speed: float = 2.0  # Transit speed in m/s (default from spreadsheet)
    station_keep_time: float = 5.0  # Station keeping duration in minutes
    surface_drift_time: float = 5.0 # Surface drift duration in minutes 
    planning_mode: str = "time"  # 'time' or 'resolution'
    shoreline_offset: float = 25.0  # Offset from shoreline in meters (shifts all points offshore)
    drift_offset_fraction: float = (
        0.5  # Drift position as fraction of transect distance beyond offshore
    )
    bot_id_display_offset: int = 1  # Added to bot_id for human-readable display (1 = 1-indexed)
    home_offset: float = 25.0  # Distance onshore of shoreline for home/recovery point (meters)
    bot_ids: Optional[List[int]] = None  # Explicit list of bot IDs (overrides num_bots)

    def __post_init__(self):
        """Validate parameters"""
        if self.bot_ids is not None:
            if len(self.bot_ids) == 0:
                raise ValueError("bot_ids must not be empty")
            if len(set(self.bot_ids)) != len(self.bot_ids):
                raise ValueError("bot_ids must not contain duplicates")
            self.num_bots = len(self.bot_ids)
            self.bot_id_display_offset = 0
        else:
            if self.num_bots <= 0:
                raise ValueError("num_bots must be positive")
            self.bot_ids = list(range(self.num_bots))

        if self.planning_mode not in ["time", "resolution"]:
            raise ValueError("planning_mode must be 'time' or 'resolution'")

        if self.planning_mode == "time" and self.mission_duration is None:
            raise ValueError("mission_duration required for 'time' planning mode")

        if self.planning_mode == "resolution" and self.target_resolution is None:
            raise ValueError("target_resolution required for 'resolution' planning mode")

        if self.shoreline_offset < 0:
            raise ValueError("shoreline_offset must be non-negative")


@dataclass
class MeasurementLocation:
    """Represents a single measurement location"""

    location_id: int
    distance_from_shore: float  # meters
    latitude: float
    longitude: float
    bot_id: int  # Which bot performs this measurement


@dataclass
class DriftLocation:
    """Represents a drift location for a bot after completing measurements"""

    bot_id: int  # Which bot performs this drift
    distance_from_shore: float  # meters
    latitude: float
    longitude: float
    drift_duration: float  # minutes


@dataclass
class BotBehavior:
    """Represents the behavior sequence for a single bot"""

    bot_id: int
    sequence: List[Dict]  # Ordered list of actions


@dataclass
class HomeLocation:
    """Represents the home/recovery location onshore of the transect"""

    latitude: float
    longitude: float
    distance_from_shore: float  # Negative value (onshore of shoreline)


@dataclass
class MissionPlan:
    """Output of the mission planning"""

    measurement_locations: List[MeasurementLocation]
    estimated_mission_time: float  # minutes
    total_distance: float  # meters (cross-shore extent)
    cross_shore_resolution: float  # meters between measurements
    measurements_per_bot: Dict[int, int]
    transit_time: float  # minutes
    measurement_time: float  # minutes
    drift_time: float  # minutes (drift behavior duration)
    drift_location: DriftLocation  # Single drift point for one bot
    drift_bot_id: int  # Which bot performs the drift
    home_location: HomeLocation  # Recovery point onshore of transect
    bot_behaviors: List[BotBehavior]  # Explicit behavior sequence per bot
    summary: str


class JaiabotMissionPlanner:
    """Main class for planning jaiabot surfzone missions"""

    # Calibration coefficients from spreadsheet
    TRANSIT_BATTERY_PER_KM = 7.647059  # % battery per km
    DIVE_BATTERY_PER_M = 0.093201  # % battery per meter of depth per dive

    # Jaia mission format constants
    JAIA_MISSION_SET_VERSION = "2.0"
    JAIA_TASK_DIVE = "DIVE"
    JAIA_TASK_STATION_KEEP = "STATION_KEEP"
    JAIA_TASK_SURFACE_DRIFT = "SURFACE_DRIFT"
    JAIA_UNASSIGNED_ID = -1
    JAIA_DEFAULT_STATIONKEEP_OUTER_SPEED = 2

    # Jaia protobuf MissionPlan constants
    JAIA_PROTOBUF_START_IMMEDIATELY = "START_IMMEDIATELY"
    JAIA_PROTOBUF_START_ON_COMMAND = "START_ON_COMMAND"
    JAIA_PROTOBUF_MOVEMENT_TRANSIT = "TRANSIT"

    # Jaia protobuf Command constants
    JAIA_COMMAND_TYPE_MISSION_PLAN = "MISSION_PLAN"

    def __init__(self, params: MissionParameters):
        """
        Initialize the mission planner with parameters

        Args:
            params: MissionParameters object with all input parameters
        """
        self.params = params
        self.total_distance = self._calculate_distance()

    def _calculate_distance(self) -> float:
        """
        Calculate cross-shore distance using Haversine formula

        Returns:
            Distance in meters
        """
        # Haversine formula for distance between two lat/lon points
        R = 6371000  # Earth radius in meters

        lat1 = np.radians(self.params.shoreline_lat)
        lat2 = np.radians(self.params.offshore_lat)
        lon1 = np.radians(self.params.shoreline_lon)
        lon2 = np.radians(self.params.offshore_lon)

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

        distance = R * c
        return distance

    def _interpolate_position(self, fraction: float) -> Tuple[float, float]:
        """
        Interpolate lat/lon position along the transect line

        Args:
            fraction: Fraction of distance along transect (0 = shore, 1 = offshore)
                      Can be >1.0 when shoreline_offset extends past offshore point

        Returns:
            Tuple of (latitude, longitude)
        """
        # Linear interpolation/extrapolation (good approximation for short distances)
        lat = self.params.shoreline_lat + fraction * (
            self.params.offshore_lat - self.params.shoreline_lat
        )
        lon = self.params.shoreline_lon + fraction * (
            self.params.offshore_lon - self.params.shoreline_lon
        )
        return lat, lon

    def plan_mission(self) -> MissionPlan:
        """
        Plan the mission by distributing measurements along the transect

        Two planning modes:
        1. 'time' mode: Maximize measurements within time constraint
           - More bots = higher resolution (more measurements)
        2. 'resolution' mode: Achieve target resolution, minimize time
           - More bots = faster mission (same measurements, less time per bot)

        Returns:
            MissionPlan object with all planning results
        """
        if self.params.planning_mode == "time":
            return self._plan_by_time()
        else:  # resolution mode
            return self._plan_by_resolution()

    def _plan_by_time(self) -> MissionPlan:
        """
        Plan mission to maximize measurements within time constraint

        Strategy:
        1. Calculate how many measurements can fit in the mission duration
        2. Account for transit time between measurements
        3. Distribute measurements evenly along transect
        4. Assign measurements to bots

        Returns:
            MissionPlan object with all planning results
        """
        # Convert times to seconds for calculation
        measurement_time_sec = self.params.measurement_time * 60
        mission_duration_sec = self.params.mission_duration * 60

        # Initial estimate: how many measurements if we ignore transit?
        # Since bots work simultaneously, we get num_bots measurements per time slot
        max_possible_measurements = int(
            (mission_duration_sec / measurement_time_sec) * self.params.num_bots
        )

        # Now we need to account for transit time
        # We'll iterate to find the optimal number of measurements
        best_plan = None

        for num_measurements in range(max_possible_measurements, 0, -1):
            # Calculate spacing
            if num_measurements <= 1:
                spacing = 0
            else:
                spacing = self.total_distance / (num_measurements - 1)

            # Calculate time for this configuration
            total_time_sec = self._calculate_mission_time(num_measurements, spacing)

            # Check if this fits within mission duration
            if total_time_sec <= mission_duration_sec:
                # This works! Create the plan
                locations = self._create_measurement_locations(num_measurements, spacing)

                measurements_per_bot_dict = self._get_measurements_per_bot(num_measurements)

                cross_shore_resolution = spacing if num_measurements > 1 else 0

                # Calculate time components
                transit_time_sec = self._calculate_transit_time(num_measurements, spacing)
                measurement_time_sec_total = self._calculate_total_measurement_time(
                    num_measurements
                )
                drift_time_sec = self.params.surface_drift_time * 60

                # Create drift location, home location, and bot behaviors
                drift_location, drift_bot_id = self._create_drift_location(locations, spacing)
                home_location = self._create_home_location()
                bot_behaviors = self._create_bot_behaviors(
                    locations, drift_location, drift_bot_id, home_location
                )

                summary = self._create_summary(
                    num_measurements,
                    total_time_sec / 60,
                    cross_shore_resolution,
                    transit_time_sec / 60,
                    measurement_time_sec_total / 60,
                    drift_time_sec / 60,
                    drift_location,
                    drift_bot_id,
                    home_location,
                )

                best_plan = MissionPlan(
                    measurement_locations=locations,
                    estimated_mission_time=total_time_sec / 60,
                    total_distance=self.total_distance,
                    cross_shore_resolution=cross_shore_resolution,
                    measurements_per_bot=measurements_per_bot_dict,
                    transit_time=transit_time_sec / 60,
                    measurement_time=measurement_time_sec_total / 60,
                    drift_time=drift_time_sec / 60,
                    drift_location=drift_location,
                    drift_bot_id=drift_bot_id,
                    home_location=home_location,
                    bot_behaviors=bot_behaviors,
                    summary=summary,
                )
                break

        if best_plan is None:
            # Even one measurement doesn't fit
            raise ValueError(
                f"Mission duration ({self.params.mission_duration} min) is too short "
                f"for even a single measurement ({self.params.measurement_time} min)"
            )

        return best_plan

    def _plan_by_resolution(self) -> MissionPlan:
        """
        Plan mission to achieve target resolution, minimize time

        Strategy:
        1. Calculate number of measurements needed for target resolution
        2. Distribute measurements across available bots
        3. Calculate minimum time to complete mission
        4. Bots work simultaneously, so time = max(time_per_bot)

        Returns:
            MissionPlan object with all planning results
        """
        # Calculate number of measurements needed
        num_measurements = int(np.ceil(self.total_distance / self.params.target_resolution)) + 1

        # Actual spacing will be slightly different to fit exactly
        spacing = self.total_distance / (num_measurements - 1) if num_measurements > 1 else 0

        # Calculate mission time
        total_time_sec = self._calculate_mission_time(num_measurements, spacing)

        # Create locations
        locations = self._create_measurement_locations(num_measurements, spacing)

        measurements_per_bot_dict = self._get_measurements_per_bot(num_measurements)

        # Calculate time components
        transit_time_sec = self._calculate_transit_time(num_measurements, spacing)
        measurement_time_sec = self._calculate_total_measurement_time(num_measurements)
        drift_time_sec = self.params.surface_drift_time * 60

        # Create drift location, home location, and bot behaviors
        drift_location, drift_bot_id = self._create_drift_location(locations, spacing)
        home_location = self._create_home_location()
        bot_behaviors = self._create_bot_behaviors(
            locations, drift_location, drift_bot_id, home_location
        )

        summary = self._create_summary(
            num_measurements,
            total_time_sec / 60,
            spacing,
            transit_time_sec / 60,
            measurement_time_sec / 60,
            drift_time_sec / 60,
            drift_location,
            drift_bot_id,
            home_location,
        )

        return MissionPlan(
            measurement_locations=locations,
            estimated_mission_time=total_time_sec / 60,
            total_distance=self.total_distance,
            cross_shore_resolution=spacing,
            measurements_per_bot=measurements_per_bot_dict,
            transit_time=transit_time_sec / 60,
            measurement_time=measurement_time_sec / 60,
            drift_time=drift_time_sec / 60,
            drift_location=drift_location,
            drift_bot_id=drift_bot_id,
            home_location=home_location,
            bot_behaviors=bot_behaviors,
            summary=summary,
        )

    def _calculate_mission_time(self, num_measurements: int, spacing: float) -> float:
        """
        Calculate total mission time for given configuration

        Args:
            num_measurements: Total number of measurements
            spacing: Distance between measurements in meters

        Returns:
            Total time in seconds
        """
        transit_time_sec = self._calculate_transit_time(num_measurements, spacing)
        measurement_time_sec = self._calculate_total_measurement_time(num_measurements)
        drift_time_sec = self.params.surface_drift_time * 60  # One bot drifts
        # Post-drift dive time (dive_time = measurement_time - station_keep_time)
        post_drift_dive_sec = (
            max(0, self.params.measurement_time - self.params.station_keep_time) * 60
        )
        return transit_time_sec + measurement_time_sec + drift_time_sec + post_drift_dive_sec

    def _calculate_transit_time(self, num_measurements: int, spacing: float) -> float:
        """
        Calculate total transit time (worst case bot)

        Args:
            num_measurements: Total number of measurements
            spacing: Distance between measurements in meters

        Returns:
            Transit time in seconds
        """
        measurements_per_bot = num_measurements // self.params.num_bots
        extra_measurements = num_measurements % self.params.num_bots

        max_transit_distance = 0

        for bot_idx in range(self.params.num_bots):
            bot_measurements = measurements_per_bot + (1 if bot_idx < extra_measurements else 0)

            if bot_measurements > 0:
                # First measurement location for this bot
                first_idx = bot_idx
                first_distance = (
                    (first_idx / (num_measurements - 1)) * self.total_distance
                    if num_measurements > 1
                    else 0
                )

                # Transit to first location
                bot_transit = first_distance

                # Transit between consecutive measurements
                if bot_measurements > 1:
                    between_measurement_spacing = spacing * self.params.num_bots
                    bot_transit += between_measurement_spacing * (bot_measurements - 1)

                max_transit_distance = max(max_transit_distance, bot_transit)

        return max_transit_distance / self.params.transit_speed

    def _calculate_total_measurement_time(self, num_measurements: int) -> float:
        """
        Calculate total measurement time (all bots work simultaneously)

        Args:
            num_measurements: Total number of measurements

        Returns:
            Measurement time in seconds
        """
        measurement_time_sec = self.params.measurement_time * 60
        measurements_per_bot = num_measurements // self.params.num_bots
        extra_measurements = num_measurements % self.params.num_bots

        # Max measurements any single bot has to do
        max_measurements_per_bot = measurements_per_bot + (1 if extra_measurements > 0 else 0)

        return max_measurements_per_bot * measurement_time_sec

    def _get_measurements_per_bot(self, num_measurements: int) -> Dict[int, int]:
        """Get dictionary of measurements per bot"""
        measurements_per_bot = num_measurements // self.params.num_bots
        extra_measurements = num_measurements % self.params.num_bots

        return {
            bot_id: measurements_per_bot + (1 if bot_idx < extra_measurements else 0)
            for bot_idx, bot_id in enumerate(self.params.bot_ids)
        }

    def _create_measurement_locations(
        self, num_measurements: int, spacing: float
    ) -> List[MeasurementLocation]:
        """
        Create the list of measurement locations

        Args:
            num_measurements: Total number of measurements
            spacing: Distance between measurements in meters

        Returns:
            List of MeasurementLocation objects
        """
        locations = []

        for i in range(num_measurements):
            # Base distance along original transect
            base_distance = (
                (i / (num_measurements - 1)) * self.total_distance if num_measurements > 1 else 0
            )
            # Apply offshore offset (shifts all points uniformly offshore)
            distance = base_distance + self.params.shoreline_offset
            # Fraction for interpolation (can exceed 1.0 with offset)
            fraction = distance / self.total_distance if self.total_distance > 0 else 0
            lat, lon = self._interpolate_position(fraction)

            # Assign to bot (round-robin distribution)
            bot_id = self.params.bot_ids[i % self.params.num_bots]

            location = MeasurementLocation(
                location_id=i,
                distance_from_shore=distance,
                latitude=lat,
                longitude=lon,
                bot_id=bot_id,
            )
            locations.append(location)

        return locations

    def _create_drift_location(
        self, measurement_locations: List[MeasurementLocation], spacing: float
    ) -> Tuple[DriftLocation, int]:
        """
        Create a single drift location beyond the offshore point.

        The drift is assigned to the bot that performs the most offshore measurement.
        Position is at drift_offset_fraction of the transect distance beyond the offshore point.

        Args:
            measurement_locations: List of measurement locations
            spacing: Distance between measurements in meters (unused, kept for API compat)

        Returns:
            Tuple of (DriftLocation, drift_bot_id)
        """
        # Calculate drift offset as fraction of total transect distance
        drift_offset = self.params.drift_offset_fraction * self.total_distance

        if not measurement_locations:
            # Fallback for edge case
            drift_distance = self.total_distance + drift_offset
            fraction = drift_distance / self.total_distance if self.total_distance > 0 else 1.0
            drift_lat, drift_lon = self._interpolate_position(fraction)
            return (
                DriftLocation(
                    bot_id=self.params.bot_ids[0],
                    distance_from_shore=drift_distance,
                    latitude=drift_lat,
                    longitude=drift_lon,
                    drift_duration=self.params.surface_drift_time,
                ),
                self.params.bot_ids[0],
            )

        # Find the most offshore measurement and which bot is assigned to it
        most_offshore = max(measurement_locations, key=lambda loc: loc.distance_from_shore)
        drift_bot_id = most_offshore.bot_id

        # Calculate drift distance: fraction of transect distance beyond the offshore point
        drift_distance = self.total_distance + drift_offset

        # Calculate drift position using interpolation (fraction > 1 extends beyond)
        fraction = drift_distance / self.total_distance if self.total_distance > 0 else 1.0
        drift_lat, drift_lon = self._interpolate_position(fraction)

        drift_location = DriftLocation(
            bot_id=drift_bot_id,
            distance_from_shore=drift_distance,
            latitude=drift_lat,
            longitude=drift_lon,
            drift_duration=self.params.surface_drift_time,
        )

        return drift_location, drift_bot_id

    def _create_home_location(self) -> HomeLocation:
        """
        Create home/recovery location onshore of the transect start.

        Position is home_offset meters onshore (before) the shoreline point.

        Returns:
            HomeLocation object
        """
        # Calculate position onshore of shoreline (negative fraction)
        home_distance = -self.params.home_offset  # Negative = onshore
        fraction = home_distance / self.total_distance if self.total_distance > 0 else 0
        home_lat, home_lon = self._interpolate_position(fraction)

        return HomeLocation(
            latitude=home_lat,
            longitude=home_lon,
            distance_from_shore=home_distance,
        )

    def _create_bot_behaviors(
        self,
        measurement_locations: List[MeasurementLocation],
        drift_location: DriftLocation,
        drift_bot_id: int,
        home_location: HomeLocation,
    ) -> List[BotBehavior]:
        """
        Create explicit behavior sequences for each bot.

        Each bot's sequence includes:
        - Transit to first measurement location
        - For each measurement: station_keep -> dive -> transit to next
        - For drift bot only: final drift behavior
        - Return home transit (all bots)

        Args:
            measurement_locations: List of measurement locations
            drift_location: The drift location
            drift_bot_id: Which bot performs the drift
            home_location: The home/recovery location

        Returns:
            List of BotBehavior objects, one per bot
        """
        # Group measurements by bot
        bot_measurements: Dict[int, List[MeasurementLocation]] = {}
        for loc in measurement_locations:
            if loc.bot_id not in bot_measurements:
                bot_measurements[loc.bot_id] = []
            bot_measurements[loc.bot_id].append(loc)

        # Sort each bot's measurements by distance (they should already be in order)
        for bot_id in bot_measurements:
            bot_measurements[bot_id].sort(key=lambda loc: loc.distance_from_shore)

        # Calculate dive time (measurement_time - station_keep_time)
        dive_time = max(0, self.params.measurement_time - self.params.station_keep_time)

        bot_behaviors = []
        for bot_id in self.params.bot_ids:
            sequence = []
            locations = bot_measurements.get(bot_id, [])

            for i, loc in enumerate(locations):
                # Transit to this location
                sequence.append(
                    {
                        "action": "transit",
                        "to_location_id": loc.location_id,
                        "latitude": loc.latitude,
                        "longitude": loc.longitude,
                    }
                )

                # Station keep
                sequence.append(
                    {
                        "action": "station_keep",
                        "duration_min": self.params.station_keep_time,
                        "location_id": loc.location_id,
                    }
                )

                # Dive
                sequence.append(
                    {
                        "action": "dive",
                        "duration_min": dive_time,
                        "location_id": loc.location_id,
                    }
                )

            # Add drift for the drift bot only
            if bot_id == drift_bot_id:
                sequence.append(
                    {
                        "action": "transit",
                        "to_drift": True,
                        "latitude": drift_location.latitude,
                        "longitude": drift_location.longitude,
                    }
                )
                sequence.append(
                    {
                        "action": "drift",
                        "duration_min": drift_location.drift_duration,
                        "latitude": drift_location.latitude,
                        "longitude": drift_location.longitude,
                    }
                )
                # Dive after drift
                sequence.append(
                    {
                        "action": "dive",
                        "duration_min": dive_time,
                        "latitude": drift_location.latitude,
                        "longitude": drift_location.longitude,
                    }
                )

            # All bots return home at the end
            sequence.append(
                {
                    "action": "return_home",
                    "latitude": home_location.latitude,
                    "longitude": home_location.longitude,
                }
            )

            bot_behaviors.append(BotBehavior(bot_id=bot_id, sequence=sequence))

        return bot_behaviors

    def _create_summary(
        self,
        num_measurements: int,
        total_time: float,
        resolution: float,
        transit_time: float,
        measurement_time: float,
        drift_time: float,
        drift_location: DriftLocation,
        drift_bot_id: int,
        home_location: HomeLocation,
    ) -> str:
        """Create a human-readable summary of the mission plan"""
        offset_line = (
            f"Shoreline Offset: {self.params.shoreline_offset:.1f} m\n"
            if self.params.shoreline_offset > 0
            else ""
        )
        display_offset = self.params.bot_id_display_offset
        summary = f"""
Mission Plan Summary
====================
Cross-shore Distance: {self.total_distance:.1f} m
{offset_line}Number of Bots: {self.params.num_bots}
Total Measurements: {num_measurements}
Cross-shore Resolution: {resolution:.1f} m

Time Budget:
  Transit Time: {transit_time:.1f} min ({transit_time/total_time*100:.1f}%)
  Measurement Time: {measurement_time:.1f} min ({measurement_time/total_time*100:.1f}%)
  Drift Time: {drift_time:.1f} min ({drift_time/total_time*100:.1f}%)
  Total Mission Time: {total_time:.1f} min

Measurements per Bot:
"""
        # Calculate measurements per bot
        measurements_per_bot = num_measurements // self.params.num_bots
        extra = num_measurements % self.params.num_bots

        for bot_idx, bot_id in enumerate(self.params.bot_ids):
            count = measurements_per_bot + (1 if bot_idx < extra else 0)
            display_id = bot_id + display_offset
            drift_marker = " (+ drift)" if bot_id == drift_bot_id else ""
            summary += f"  Bot {display_id}: {count} measurements{drift_marker}\n"

        # Add drift and home section
        drift_display_id = drift_bot_id + display_offset
        drift_dist = drift_location.distance_from_shore
        home_dist = abs(home_location.distance_from_shore)
        summary += f"""
Drift & Recovery:
  Bot {drift_display_id} drifts at {drift_dist:.1f}m offshore for {drift_time:.1f} min
  All bots return to home at {home_dist:.1f}m onshore
"""

        return summary.strip()

    def export_locations_to_dict(self, mission_plan: MissionPlan) -> Dict:
        """
        Export measurement locations to a dictionary format

        Args:
            mission_plan: MissionPlan object

        Returns:
            Dictionary with mission plan data
        """
        display_offset = self.params.bot_id_display_offset
        drift = mission_plan.drift_location

        return {
            "mission_parameters": {
                "shoreline": {
                    "lat": self.params.shoreline_lat,
                    "lon": self.params.shoreline_lon,
                },
                "offshore": {
                    "lat": self.params.offshore_lat,
                    "lon": self.params.offshore_lon,
                },
                "num_bots": self.params.num_bots,
                "bot_ids": self.params.bot_ids,
                "measurement_time_min": self.params.measurement_time,
                "mission_duration_min": self.params.mission_duration,
                "shoreline_offset_m": self.params.shoreline_offset,
                "drift_offset_fraction": self.params.drift_offset_fraction,
                "bot_id_display_offset": self.params.bot_id_display_offset,
                "station_keep_time_min": self.params.station_keep_time,
            },
            "mission_results": {
                "total_distance_m": mission_plan.total_distance,
                "estimated_mission_time_min": mission_plan.estimated_mission_time,
                "cross_shore_resolution_m": mission_plan.cross_shore_resolution,
                "total_measurements": len(mission_plan.measurement_locations),
                "transit_time_min": mission_plan.transit_time,
                "measurement_time_min": mission_plan.measurement_time,
                "drift_time_min": mission_plan.drift_time,
                "drift_bot_id": mission_plan.drift_bot_id,
                "drift_bot_display_id": mission_plan.drift_bot_id + display_offset,
            },
            "measurements": [
                {
                    "id": loc.location_id,
                    "bot_id": loc.bot_id,
                    "display_bot_id": loc.bot_id + display_offset,
                    "distance_from_shore_m": loc.distance_from_shore,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                }
                for loc in mission_plan.measurement_locations
            ],
            "drift_location": {
                "bot_id": drift.bot_id,
                "display_bot_id": drift.bot_id + display_offset,
                "distance_from_shore_m": drift.distance_from_shore,
                "latitude": drift.latitude,
                "longitude": drift.longitude,
                "drift_duration_min": drift.drift_duration,
            },
            "home_location": {
                "distance_from_shore_m": mission_plan.home_location.distance_from_shore,
                "latitude": mission_plan.home_location.latitude,
                "longitude": mission_plan.home_location.longitude,
            },
            "bot_behaviors": [
                {
                    "bot_id": behavior.bot_id,
                    "display_bot_id": behavior.bot_id + display_offset,
                    "sequence": behavior.sequence,
                }
                for behavior in mission_plan.bot_behaviors
            ],
        }

    def export_locations_to_json(self, mission_plan: MissionPlan, filename: str):
        """
        Export measurement locations to JSON file

        Args:
            mission_plan: MissionPlan object
            filename: Output JSON filename
        """
        data = self.export_locations_to_dict(mission_plan)
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)

    def _convert_behavior_to_jaia_waypoints(
        self,
        behavior: BotBehavior,
        dive_depth: float,
        dive_depth_interval: float,
        dive_hold_time: float,
        bottom_dive: bool,
    ) -> List[Dict]:
        """
        Convert a bot's behavior sequence to Jaia v2.0 Waypoint dicts.

        Maps internal action types to Jaia Task types using v2.0 serialization format:
        - station_keep -> STATION_KEEP with stationKeepParameters
        - dive -> DIVE with diveParameters
        - drift -> SURFACE_DRIFT with driftParameters
        - transit, return_home -> skipped (handled by waypoint sequence)

        Args:
            behavior: BotBehavior with sequence of actions
            dive_depth: Maximum dive depth in meters
            dive_depth_interval: Depth sampling interval in meters
            dive_hold_time: Time to hold at depth in seconds
            bottom_dive: Whether to dive to bottom

        Returns:
            List of Waypoint dicts in Jaia v2.0 format
        """
        waypoints = []

        for action in behavior.sequence:
            action_type = action["action"]

            if action_type == "station_keep":
                loc_id = action.get("location_id")
                loc = self._get_location_by_id(loc_id)
                if loc:
                    waypoints.append(
                        {
                            "location": {"lat": loc.latitude, "lon": loc.longitude},
                            "task": {
                                "type": self.JAIA_TASK_STATION_KEEP,
                                "stationKeepParameters": {
                                    "station_keep_time": int(action["duration_min"] * 60)
                                },
                            },
                        }
                    )

            elif action_type == "dive":
                loc_id = action.get("location_id")
                if loc_id is not None:
                    loc = self._get_location_by_id(loc_id)
                    if loc:
                        waypoints.append(
                            {
                                "location": {
                                    "lat": loc.latitude,
                                    "lon": loc.longitude,
                                },
                                "task": {
                                    "type": self.JAIA_TASK_DIVE,
                                    "isBottomDive": bottom_dive,
                                    "diveParameters": {
                                        "max_depth": dive_depth,
                                        "depth_interval": dive_depth_interval,
                                        "hold_time": int(dive_hold_time),
                                        "bottom_dive": bottom_dive,
                                    },
                                },
                            }
                        )
                else:
                    # Drift dive (at drift location)
                    waypoints.append(
                        {
                            "location": {
                                "lat": action["latitude"],
                                "lon": action["longitude"],
                            },
                            "task": {
                                "type": self.JAIA_TASK_DIVE,
                                "isBottomDive": bottom_dive,
                                "diveParameters": {
                                    "max_depth": dive_depth,
                                    "depth_interval": dive_depth_interval,
                                    "hold_time": int(dive_hold_time),
                                    "bottom_dive": bottom_dive,
                                },
                            },
                        }
                    )

            elif action_type == "drift":
                waypoints.append(
                    {
                        "location": {
                            "lat": action["latitude"],
                            "lon": action["longitude"],
                        },
                        "task": {
                            "type": self.JAIA_TASK_SURFACE_DRIFT,
                            "driftParameters": {"drift_time": int(action["duration_min"] * 60)},
                        },
                    }
                )

            # Skip transit and return_home - handled by waypoint sequence

        return waypoints

    def _get_location_by_id(self, location_id: int) -> MeasurementLocation:
        """Helper to get measurement location by ID from cached locations."""
        if not hasattr(self, "_cached_locations"):
            return None
        for loc in self._cached_locations:
            if loc.location_id == location_id:
                return loc
        return None

    def export_to_jaia_mission_set_dict(
        self,
        mission_plan: MissionPlan,
        mission_name: str = "Surfzone Mission",
        dive_depth_interval: float = 50.0,
        dive_hold_time: float = 0.0,
        bottom_dive: bool = True,
    ) -> Dict:
        """
        Export mission plan to Jaia v2.0 MissionSet dictionary format.

        Generates a JSON-compatible dict with version "2.0" and a MissionSetSnapshot
        containing one Mission per bot, each with waypoints (station keep, dive, drift).

        Compatible with Jaia v2.0+ mission set import via JCC GUI (jaiabot release 2.5.0+).

        By default, dives are configured as bottom dives (max_depth=50, depth_interval=50,
        hold_time=0, bottom_dive=True) where the bot dives until it hits the bottom
        then returns to the surface.

        Args:
            mission_plan: MissionPlan object from plan_mission()
            mission_name: Human-readable mission name
            dive_depth_interval: Depth interval for dive in meters (default 50 for bottom dive)
            dive_hold_time: Time to hold at depth in seconds (default 0 for bottom dive)
            bottom_dive: Whether to perform a bottom dive (default True)

        Returns:
            Dict in Jaia v2.0 mission set format with version and snapshot
        """
        # Cache measurement locations for lookup
        self._cached_locations = mission_plan.measurement_locations

        display_offset = self.params.bot_id_display_offset
        missions = []
        mission_speeds = {
            "transit": self.params.transit_speed,
            "stationkeep_outer": self.JAIA_DEFAULT_STATIONKEEP_OUTER_SPEED,
        }

        for behavior in mission_plan.bot_behaviors:
            bot_id = behavior.bot_id
            mission_id = bot_id + display_offset

            # Convert behavior to Jaia v2.0 waypoints
            waypoints = self._convert_behavior_to_jaia_waypoints(
                behavior,
                dive_depth=self.params.dive_depth,
                dive_depth_interval=dive_depth_interval,
                dive_hold_time=dive_hold_time,
                bottom_dive=bottom_dive,
            )

            # Add HOME waypoint at the end for each bot to navigate to beach
            waypoints.append(
                {
                    "location": {
                        "lat": mission_plan.home_location.latitude,
                        "lon": mission_plan.home_location.longitude,
                    },
                    "task": {
                        "type": self.JAIA_TASK_STATION_KEEP,
                        "stationKeepParameters": {"station_keep_time": 1},
                    },
                }
            )

            # Build the Mission object
            mission = {
                "missionID": mission_id,
                "waypoints": waypoints,
                "speeds": dict(mission_speeds),
                "repeats": 1,
                "ghostParameters": {
                    "hasStarted": False,
                    "botID": self.JAIA_UNASSIGNED_ID,
                    "repeats": 1,
                },
            }

            missions.append([mission_id, mission])

        # Clean up cached locations
        del self._cached_locations

        next_mission_id = missions[-1][0] + 1 if missions else 1

        return {
            "version": self.JAIA_MISSION_SET_VERSION,
            "snapshot": {
                "missions": missions,
                "nextMissionID": next_mission_id,
                "missionIDInEditMode": self.JAIA_UNASSIGNED_ID,
                "missionSpeeds": mission_speeds,
                "name": mission_name,
            },
        }

    def export_to_jaia_mission_set_json(
        self,
        mission_plan: MissionPlan,
        filename: str,
        mission_name: str = "Surfzone Mission",
        dive_depth_interval: float = 50.0,
        dive_hold_time: float = 0.0,
        bottom_dive: bool = True,
    ) -> str:
        """
        Export mission plan to Jaia v2.0 MissionSet JSON file.

        Compatible with Jaia v2.0+ mission set import via JCC GUI.

        By default, dives are configured as bottom dives where the bot dives
        until it hits the bottom then returns to the surface.

        Args:
            mission_plan: MissionPlan object from plan_mission()
            filename: Output filename (with or without .json extension)
            mission_name: Human-readable mission name
            dive_depth_interval: Depth interval for dive in meters (default 50 for bottom dive)
            dive_hold_time: Time to hold at depth in seconds (default 0 for bottom dive)
            bottom_dive: Whether to perform a bottom dive (default True)

        Returns:
            Path to the created JSON file
        """
        data = self.export_to_jaia_mission_set_dict(
            mission_plan,
            mission_name=mission_name,
            dive_depth_interval=dive_depth_interval,
            dive_hold_time=dive_hold_time,
            bottom_dive=bottom_dive,
        )

        # Ensure .json extension
        if not filename.endswith(".json"):
            filename = f"{filename}.json"

        with open(filename, "w") as f:
            json.dump(data, f, indent=2)

        return filename

    def _convert_behavior_to_protobuf_goals(
        self,
        behavior: BotBehavior,
        dive_depth: float,
        dive_depth_interval: float,
        dive_hold_time: float,
        bottom_dive: bool,
    ) -> List[Dict]:
        """
        Convert a bot's behavior sequence to Jaia protobuf Goal dicts.

        Maps internal action types to Jaia protobuf MissionTask types:
        - station_keep -> STATION_KEEP with station_keep sub-message
        - dive -> DIVE with dive sub-message
        - drift -> SURFACE_DRIFT with surface_drift sub-message
        - transit, return_home -> skipped (handled by goal sequence)

        Args:
            behavior: BotBehavior with sequence of actions
            dive_depth: Maximum dive depth in meters
            dive_depth_interval: Depth sampling interval in meters
            dive_hold_time: Time to hold at depth in seconds
            bottom_dive: Whether to dive to bottom

        Returns:
            List of Goal dicts in Jaia protobuf-compliant format
        """
        goals = []

        for action in behavior.sequence:
            action_type = action["action"]

            if action_type == "station_keep":
                loc_id = action.get("location_id")
                loc = self._get_location_by_id(loc_id)
                if loc:
                    goals.append(
                        {
                            "name": f"Station Keep {loc_id}",
                            "location": {"lat": loc.latitude, "lon": loc.longitude},
                            "task": {
                                "type": self.JAIA_TASK_STATION_KEEP,
                                "station_keep": {
                                    "station_keep_time": int(action["duration_min"] * 60)
                                },
                            },
                        }
                    )

            elif action_type == "dive":
                loc_id = action.get("location_id")
                if loc_id is not None:
                    loc = self._get_location_by_id(loc_id)
                    if loc:
                        goals.append(
                            {
                                "name": f"Dive {loc_id}",
                                "location": {
                                    "lat": loc.latitude,
                                    "lon": loc.longitude,
                                },
                                "task": {
                                    "type": self.JAIA_TASK_DIVE,
                                    "dive": {
                                        "max_depth": dive_depth,
                                        "depth_interval": dive_depth_interval,
                                        "hold_time": int(dive_hold_time),
                                        "bottom_dive": bottom_dive,
                                    },
                                },
                            }
                        )
                else:
                    # Drift dive (at drift location)
                    goals.append(
                        {
                            "name": "Drift Dive",
                            "location": {
                                "lat": action["latitude"],
                                "lon": action["longitude"],
                            },
                            "task": {
                                "type": self.JAIA_TASK_DIVE,
                                "dive": {
                                    "max_depth": dive_depth,
                                    "depth_interval": dive_depth_interval,
                                    "hold_time": int(dive_hold_time),
                                    "bottom_dive": bottom_dive,
                                },
                            },
                        }
                    )

            elif action_type == "drift":
                goals.append(
                    {
                        "name": "Surface Drift",
                        "location": {
                            "lat": action["latitude"],
                            "lon": action["longitude"],
                        },
                        "task": {
                            "type": self.JAIA_TASK_SURFACE_DRIFT,
                            "surface_drift": {"drift_time": int(action["duration_min"] * 60)},
                        },
                    }
                )

            # Skip transit and return_home - handled by goal sequence

        return goals

    def export_to_jaia_mission_plan_protobuf_dict(
        self,
        mission_plan: MissionPlan,
        start_immediately: bool = True,
        dive_depth_interval: float = 50.0,
        dive_hold_time: float = 0.0,
        bottom_dive: bool = True,
    ) -> Dict[int, Dict]:
        """
        Export mission plan to Jaia protobuf-compliant MissionPlan dictionaries.

        Generates a dict mapping bot display IDs to MissionPlan dicts that are
        compatible with google.protobuf.json_format.Parse() or ParseDict().

        Each bot's mission is a MissionPlan message containing goals (waypoints),
        recovery location (onshore point), speeds, and start configuration.

        Suitable for uploading missions directly to bots via the Jaia REST API.

        By default, dives are configured as bottom dives (max_depth=50, depth_interval=50,
        hold_time=0, bottom_dive=True) where the bot dives until it hits the bottom
        then returns to the surface.

        Args:
            mission_plan: MissionPlan object from plan_mission()
            start_immediately: If True, mission starts immediately upon upload.
                If False, mission starts on command. (default: True)
            dive_depth_interval: Depth interval for dive in meters (default 50 for bottom dive)
            dive_hold_time: Time to hold at depth in seconds (default 0 for bottom dive)
            bottom_dive: Whether to perform a bottom dive (default True)

        Returns:
            Dict mapping bot display IDs to protobuf-compliant MissionPlan dicts
        """
        # Cache measurement locations for lookup
        self._cached_locations = mission_plan.measurement_locations

        display_offset = self.params.bot_id_display_offset
        start_mode = (
            self.JAIA_PROTOBUF_START_IMMEDIATELY
            if start_immediately
            else self.JAIA_PROTOBUF_START_ON_COMMAND
        )

        result = {}

        for behavior in mission_plan.bot_behaviors:
            bot_id = behavior.bot_id
            bot_display_id = bot_id + display_offset

            # Convert behavior to protobuf-compliant goals
            goals = self._convert_behavior_to_protobuf_goals(
                behavior,
                dive_depth=self.params.dive_depth,
                dive_depth_interval=dive_depth_interval,
                dive_hold_time=dive_hold_time,
                bottom_dive=bottom_dive,
            )

            # Build the protobuf-compliant MissionPlan
            mission_plan_dict = {
                "start": start_mode,
                "movement": self.JAIA_PROTOBUF_MOVEMENT_TRANSIT,
                "goal": goals,
                "recovery": {
                    "recover_at_final_goal": False,
                    "location": {
                        "lat": mission_plan.home_location.latitude,
                        "lon": mission_plan.home_location.longitude,
                    },
                },
                "speeds": {
                    "transit": self.params.transit_speed,
                    "stationkeep_outer": self.JAIA_DEFAULT_STATIONKEEP_OUTER_SPEED,
                },
                "repeats": 1,
            }

            result[bot_display_id] = mission_plan_dict

        # Clean up cached locations
        del self._cached_locations

        return result

    def export_to_jaia_command_protobuf_dict(
        self,
        mission_plan: MissionPlan,
        start_immediately: bool = True,
        dive_depth_interval: float = 50.0,
        dive_hold_time: float = 0.0,
        bottom_dive: bool = True,
    ) -> Dict[int, Dict]:
        """
        Export mission plan to Jaia protobuf-compliant Command dictionaries.

        Generates a dict mapping bot display IDs to Command dicts that wrap
        each bot's MissionPlan in a Command message. The output is compatible
        with google.protobuf.json_format.Parse() or ParseDict() for the
        jaiabot.protobuf.Command message.

        Suitable for uploading missions directly to bots via the Jaia REST API.

        By default, dives are configured as bottom dives (max_depth=50, depth_interval=50,
        hold_time=0, bottom_dive=True) where the bot dives until it hits the bottom
        then returns to the surface.

        Args:
            mission_plan: MissionPlan object from plan_mission()
            start_immediately: If True, mission starts immediately upon upload.
                If False, mission starts on command. (default: True)
            dive_depth_interval: Depth interval for dive in meters (default 50 for bottom dive)
            dive_hold_time: Time to hold at depth in seconds (default 0 for bottom dive)
            bottom_dive: Whether to perform a bottom dive (default True)

        Returns:
            Dict mapping bot display IDs to protobuf-compliant Command dicts
        """
        mission_plans = self.export_to_jaia_mission_plan_protobuf_dict(
            mission_plan,
            start_immediately=start_immediately,
            dive_depth_interval=dive_depth_interval,
            dive_hold_time=dive_hold_time,
            bottom_dive=bottom_dive,
        )

        # Current time in microseconds
        time_usec = int(time.time() * 1e6)

        result = {}
        for bot_display_id, plan_dict in mission_plans.items():
            command = {
                "bot_id": bot_display_id,
                "time": time_usec,
                "type": self.JAIA_COMMAND_TYPE_MISSION_PLAN,
                "plan": plan_dict,
            }
            result[bot_display_id] = command

        return result


def plan_surfzone_mission(
    shoreline_lat: float,
    shoreline_lon: float,
    offshore_lat: float,
    offshore_lon: float,
    num_bots: int,
    measurement_time: float,
    mission_duration: float = None,
    target_resolution: float = None,
    planning_mode: str = "time",
    shoreline_offset: float = 25.0,
    drift_offset_fraction: float = 0.5,
    bot_id_display_offset: int = 1,
    home_offset: float = 25.0,
    bot_ids: Optional[List[int]] = None,
    **kwargs,
) -> MissionPlan:
    """
    Convenience function to plan a surfzone mission

    Two planning modes available:

    1. TIME MODE (default): Maximize measurements within time constraint
       - Specify: mission_duration
       - Result: More bots = higher resolution (more measurements)

    2. RESOLUTION MODE: Achieve target resolution, minimize time
       - Specify: target_resolution
       - Result: More bots = faster mission (same measurements)

    Args:
        shoreline_lat: Latitude of shoreline point
        shoreline_lon: Longitude of shoreline point
        offshore_lat: Latitude of offshore extent
        offshore_lon: Longitude of offshore extent
        num_bots: Number of bots available
        measurement_time: Time per measurement in minutes (station keep + dive)
        mission_duration: Total mission duration in minutes (for 'time' mode)
        target_resolution: Target spacing in meters (for 'resolution' mode)
        planning_mode: 'time' or 'resolution' (default: 'time')
        shoreline_offset: Distance to shift measurements offshore in meters (default: 25.0)
        drift_offset_fraction: Drift as fraction of transect distance beyond offshore (default: 0.5)
        bot_id_display_offset: Added to bot_id for display (default: 1 for 1-indexed)
        home_offset: Distance onshore for home/recovery point in meters (default: 25.0)
        bot_ids: Explicit list of bot IDs (default: None, uses range(num_bots))
        **kwargs: Additional parameters (dive_depth, transit_speed, station_keep_time, etc.)

    Returns:
        MissionPlan object with measurement locations, drift, home, and bot behaviors

    Examples:
        # TIME MODE: Maximize measurements in 60 minutes
        >>> plan = plan_surfzone_mission(
        ...     shoreline_lat=35.280684,
        ...     shoreline_lon=-75.515804,
        ...     offshore_lat=35.279854,
        ...     offshore_lon=-75.511282,
        ...     num_bots=3,
        ...     measurement_time=6.0,
        ...     mission_duration=60.0,
        ...     planning_mode='time'
        ... )

        # RESOLUTION MODE: Achieve 20m resolution, minimize time
        >>> plan = plan_surfzone_mission(
        ...     shoreline_lat=35.280684,
        ...     shoreline_lon=-75.515804,
        ...     offshore_lat=35.279854,
        ...     offshore_lon=-75.511282,
        ...     num_bots=3,
        ...     measurement_time=6.0,
        ...     target_resolution=20.0,
        ...     planning_mode='resolution'
        ... )
    """
    params = MissionParameters(
        shoreline_lat=shoreline_lat,
        shoreline_lon=shoreline_lon,
        offshore_lat=offshore_lat,
        offshore_lon=offshore_lon,
        num_bots=num_bots,
        measurement_time=measurement_time,
        mission_duration=mission_duration,
        target_resolution=target_resolution,
        planning_mode=planning_mode,
        shoreline_offset=shoreline_offset,
        drift_offset_fraction=drift_offset_fraction,
        bot_id_display_offset=bot_id_display_offset,
        home_offset=home_offset,
        bot_ids=bot_ids,
        **kwargs,
    )

    planner = JaiabotMissionPlanner(params)
    return planner.plan_mission()


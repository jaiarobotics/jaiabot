import Waypoint from "../../waypoints/waypoint";
import { GeographicCoordinate } from "../../../utils/protobuf-types";

export const waypointA = new Waypoint();
const locationA: GeographicCoordinate = { lat: 41.66196, lon: -71.27445 };
waypointA.setLocation(locationA);

export const waypointB = new Waypoint();
const locationB: GeographicCoordinate = { lat: 41.66168, lon: -71.27472 };
waypointB.setLocation(locationB);

export const waypointC = new Waypoint();
const locationC: GeographicCoordinate = { lat: 41.66139, lon: -71.27472 };
waypointC.setLocation(locationC);

export const waypointD = new Waypoint();
const locationD: GeographicCoordinate = { lat: 41.66167, lon: -71.2739 };
waypointD.setLocation(locationD);

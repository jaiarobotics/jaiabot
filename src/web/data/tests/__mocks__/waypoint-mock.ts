import Waypoint from "../../waypoints/waypoint";
import { GeographicCoordinate } from "../../../utils/protobuf-types";

export const waypointA = new Waypoint();
const postitionA: GeographicCoordinate = { lat: 41.66196, lon: -71.27445 };
waypointA.setPosition(postitionA);

export const waypointB = new Waypoint();
const postitionB: GeographicCoordinate = { lat: 41.66168, lon: -71.27472 };
waypointA.setPosition(postitionB);

export const waypointC = new Waypoint();
const postitionC: GeographicCoordinate = { lat: 41.66139, lon: -71.27472 };
waypointC.setPosition(postitionC);

export const waypointD = new Waypoint();
const postitionD: GeographicCoordinate = { lat: 41.66167, lon: -71.2739 };
waypointD.setPosition(postitionD);

import Mission from "../../mission_set/mission";
import { MissionWaypoint } from "../../waypoints/waypoint";
import { locationA, locationB, locationC, locationD } from "./waypoint-mock";

const waypointA = new MissionWaypoint(locationA);
const waypointB = new MissionWaypoint(locationB);
const waypointC = new MissionWaypoint(locationC);
const waypointD = new MissionWaypoint(locationD);

const waypoints1 = [waypointA, waypointB, waypointC, waypointD];
const waypoints2 = [waypointD, waypointA, waypointB, waypointC];
const waypoints3 = [waypointC, waypointD, waypointA, waypointB];
const waypoints4 = [waypointB, waypointC, waypointD, waypointA];

export const missionA = new Mission();
missionA.addWaypoints(waypoints1);

export const missionB = new Mission();
missionB.addWaypoints(waypoints2);

export const missionC = new Mission();
missionC.addWaypoints(waypoints3);

export const missionD = new Mission();
missionD.addWaypoints(waypoints4);

export const missionE = new Mission();
export const missionF = new Mission();

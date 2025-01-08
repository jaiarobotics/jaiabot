import Mission from "../../missions/mission";
import { waypointA, waypointB, waypointC, waypointD } from "./waypoint-mock";

const waypoints1 = [waypointA, waypointB, waypointC, waypointD];
const waypoints2 = [waypointD, waypointA, waypointB, waypointC];
const waypoints3 = [waypointC, waypointD, waypointA, waypointB];
const waypoints4 = [waypointB, waypointC, waypointD, waypointA];

export const missionA = new Mission();
missionA.setWaypoints(waypoints1);

export const missionB = new Mission();
missionB.setWaypoints(waypoints2);

export const missionC = new Mission();
missionC.setWaypoints(waypoints3);

export const missionD = new Mission();
missionD.setWaypoints(waypoints4);

export const missionE = new Mission();
export const missionF = new Mission();

import { GeographicCoordinate } from "../../utils/protobuf-types";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import Waypoint from "../waypoints/waypoint";

export default class Mission {
    private missionID: number;
    private waypoints: Waypoint[];
    private repeats: number;
    private movableWaypoint: Waypoint;

    constructor() {
        this.waypoints = [];
    }

    getMissionID() {
        return this.missionID;
    }

    // Set automatically when a Mission is added to the Missions singleton
    setMissionID(missionID: number) {
        this.missionID = missionID;
    }

    getWaypoints() {
        return this.waypoints;
    }

    setWaypoints(waypoints: Waypoint[]) {
        this.waypoints = waypoints;
    }

    getRepeats() {
        return this.repeats;
    }

    setRepeats(repeats: number) {
        this.repeats = repeats;
    }

    getMovableWaypoint() {
        return this.movableWaypoint;
    }

    setMovableWaypoint(waypoint: Waypoint) {
        this.movableWaypoint = waypoint;
    }

    getWaypoint(waypointNum: number) {
        if (waypointNum > 0 && waypointNum <= this.getWaypoints().length) {
            return this.getWaypoints()[waypointNum - 1];
        }
        return undefined;
    }

    addWaypoint(location: GeographicCoordinate) {
        const waypoint = new Waypoint();
        waypoint.setLocation(location);
        this.getWaypoints().push(waypoint);
        // Sync OpenLayers
        missionLayer.addWaypoint(this.getMissionID());
    }

    deleteWaypoint(waypointNum: number) {
        let waypoints = this.getWaypoints();

        // Remove last waypoint in constant time
        if (waypointNum === waypoints.length) {
            waypoints.pop();
        }
        // Remove other waypoints in linear time
        else {
            this.setWaypoints(
                waypoints.filter((waypoint, index) => {
                    if (index + 1 !== waypointNum) {
                        return waypoint;
                    }
                }),
            );
        }
    }
}

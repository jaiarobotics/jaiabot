import Waypoint from "../waypoints/waypoint";

export default class Mission {
    private missionID: number;
    private waypoints: Waypoint[];
    private repeats: number;
    private canEdit: boolean;

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

    getCanEdit() {
        return this.canEdit;
    }

    setCanEdit(canEdit: boolean) {
        this.canEdit = canEdit;
    }

    getWaypoint(waypointNum: number) {
        if (waypointNum > 0 && waypointNum <= this.getWaypoints().length) {
            return this.getWaypoints()[waypointNum - 1];
        }
        return undefined;
    }

    addWaypoint(waypoint: Waypoint) {
        this.getWaypoints().push(waypoint);
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

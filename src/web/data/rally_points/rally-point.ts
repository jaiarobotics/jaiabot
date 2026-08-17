import { GeographicCoordinate } from "../../shared/proto/jaiabot/messages/geographic_coordinate";

export default class RallyPoint {
    private location: GeographicCoordinate;
    private rallyPointID: number;

    constructor() {}

    getRallyPointID() {
        return this.rallyPointID;
    }

    setRallyPointID(rallyPointID: number) {
        this.rallyPointID = rallyPointID;
    }

    getLocation() {
        return this.location;
    }

    setLocation(location: GeographicCoordinate) {
        this.location = location;
    }
}

import { GeographicCoordinate } from "../../types/protobuf-types";

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

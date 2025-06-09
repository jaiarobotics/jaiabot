import {
    ClientIDs,
    NodeTypes,
    SelectedNode,
    SelectedWaypoint,
    TaskParameters,
} from "../../types/jaia-system-types";
import { UNASSIGNED_ID } from "../../utils/constants";

const defaultTaskParameters: TaskParameters = {
    dive: {
        max_depth: 10,
        depth_interval: 10,
        hold_time: 0,
    },
    drift: {
        drift_time: 0,
    },
    constantHeading: {
        constant_heading: 180,
        constant_heading_time: 30,
        constant_heading_speed: 2,
    },
};

class JaiaGlobal {
    private selectedNode: SelectedNode;
    private selectedWaypoint: SelectedWaypoint;
    private defaultTaskParameters: TaskParameters;
    private clientIDs: ClientIDs;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        this.selectedWaypoint = { waypointNum: UNASSIGNED_ID, missionID: UNASSIGNED_ID };
        this.defaultTaskParameters = defaultTaskParameters;
        this.clientIDs = { clientID: "", controllingClientID: "" };
    }

    getSelectedNode() {
        return this.selectedNode;
    }

    setSelectedNode(clickedNode: SelectedNode) {
        if (
            clickedNode.type === this.getSelectedNode().type &&
            clickedNode.id === this.getSelectedNode().id
        ) {
            this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        } else {
            this.selectedNode = clickedNode;
        }
    }

    getSelectedWaypoint() {
        return this.selectedWaypoint;
    }

    setSelectedWaypoint(clickedWaypoint: SelectedWaypoint) {
        this.selectedWaypoint = clickedWaypoint;
    }

    getDefaultTaskParameters() {
        return this.defaultTaskParameters;
    }

    setDefaultTaskParameters(defaultTaskParameters: TaskParameters) {
        this.defaultTaskParameters = defaultTaskParameters;
    }

    getClientIDs() {
        return this.clientIDs;
    }

    setClientIDs(clientIDs: ClientIDs) {
        this.clientIDs = clientIDs;
    }
}

export const jaiaGlobal = new JaiaGlobal();

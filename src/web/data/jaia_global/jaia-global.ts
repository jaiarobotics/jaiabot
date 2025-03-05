import { NodeTypes, SelectedNode, SelectedWaypoint } from "../../types/jaia-system-types";
import { TaskParameters } from "../../types/jaia-system-types";
import { UNASSIGNED_ID } from "../../utils/constants";

const defaultDiveParams = {
    max_depth: 10,
    depth_interval: 10,
    hold_time: 0,
    bottom_dive: false,
};

const defaultDriftParams = {
    drift_time: 60,
};

const defaultConstantHeadingParams = {
    constant_heading: 180,
    constant_heading_time: 60,
    constant_heading_speed: 3,
};

const defaultStationKeepParams = {
    station_keep_time: 60,
};

class JaiaGlobal {
    private selectedNode: SelectedNode;
    private selectedWaypoint: SelectedWaypoint;
    private defaultTaskParameters: TaskParameters;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        this.selectedWaypoint = { waypointNum: UNASSIGNED_ID, missionID: UNASSIGNED_ID };
        this.defaultTaskParameters = {
            dive: defaultDiveParams,
            drift: defaultDriftParams,
            constantHeading: defaultConstantHeadingParams,
            stationKeep: defaultStationKeepParams,
        };
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

    getDefaultTaskParameters() {
        return this.defaultTaskParameters;
    }

    getSelectedWaypoint() {
        return this.selectedWaypoint;
    }

    setSelectedWaypoint(clickedWaypoint: SelectedWaypoint) {
        this.selectedWaypoint = clickedWaypoint;
    }

    setDefaultTaskParameters(defaultTaskParameters: TaskParameters) {
        this.defaultTaskParameters = defaultTaskParameters;
    }
}

export const jaiaGlobal = new JaiaGlobal();

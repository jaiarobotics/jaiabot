import {
    NodeTypes,
    SelectedNode,
    SelectedTask,
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
    private selectedTask: SelectedTask;
    private defaultTaskParameters: TaskParameters;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        this.selectedWaypoint = { waypointNum: UNASSIGNED_ID, missionID: UNASSIGNED_ID };
        this.selectedTask = { botID: UNASSIGNED_ID, startTime: 0 };
        this.defaultTaskParameters = defaultTaskParameters;
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

    getSelectedTask() {
        return this.selectedTask;
    }

    setSelectedTask(clickedTask: SelectedTask) {
        this.selectedTask = clickedTask;
    }

    getDefaultTaskParameters() {
        return this.defaultTaskParameters;
    }

    setDefaultTaskParameters(defaultTaskParameters: TaskParameters) {
        this.defaultTaskParameters = defaultTaskParameters;
    }
}

export const jaiaGlobal = new JaiaGlobal();

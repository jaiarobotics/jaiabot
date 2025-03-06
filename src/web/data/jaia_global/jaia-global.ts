import {
    NodeTypes,
    SelectedNode,
    SelectedWaypoint,
    TaskParameters,
} from "../../types/jaia-system-types";
import { UNASSIGNED_ID } from "../../utils/constants";

const defaultTaskParameters: TaskParameters = {
    maxDepth: 10,
    depthInterval: 10,
    holdTime: 0,
};

class JaiaGlobal {
    private selectedNode: SelectedNode;
    private selectedWaypoint: SelectedWaypoint;
    private defaultTaskParameters: TaskParameters;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        this.selectedWaypoint = { waypointNum: UNASSIGNED_ID, missionID: UNASSIGNED_ID };
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

    getDefaultTaskParameters() {
        return this.defaultTaskParameters;
    }

    setDefaultTaskParameters(defaultTaskParameters: TaskParameters) {
        this.defaultTaskParameters = defaultTaskParameters;
    }
}

export const jaiaGlobal = new JaiaGlobal();

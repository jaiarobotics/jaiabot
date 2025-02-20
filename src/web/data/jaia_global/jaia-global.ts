import { NodeTypes, SelectedNode } from "../../types/jaia-system-types";
import { UNASSIGNED_ID } from "../../utils/constants";

class JaiaGlobal {
    private selectedNode: SelectedNode;
    private missionIDInEditMode: number;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
    }

    getSelectedNode() {
        return this.selectedNode;
    }

    setSelectedNode(selectedNode: SelectedNode) {
        if (
            selectedNode.type === this.getSelectedNode().type &&
            selectedNode.id === this.getSelectedNode().id
        ) {
            this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        } else {
            this.selectedNode = selectedNode;
        }
    }

    getMissionIDInEditMode() {
        return this.missionIDInEditMode;
    }

    setMissionIDInEditMode(missionID: number) {
        if (missionID === this.getMissionIDInEditMode()) {
            this.missionIDInEditMode = UNASSIGNED_ID;
        } else {
            this.missionIDInEditMode = missionID;
        }
    }
}

export const jaiaGlobal = new JaiaGlobal();

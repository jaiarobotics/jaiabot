import { NodeTypes, SelectedNode } from "../../types/jaia-system-types";
import { UNASSIGNED_ID } from "../../utils/constants";

class JaiaGlobal {
    private selectedNode: SelectedNode;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
    }

    getSelectedNode() {
        return this.selectedNode;
    }

    setSelectedNode(selectedNode: SelectedNode) {
        if (
            selectedNode.type === this.selectedNode.type &&
            selectedNode.id === this.selectedNode.id
        ) {
            this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        } else {
            this.selectedNode = selectedNode;
        }
    }
}

export const jaiaGlobal = new JaiaGlobal();

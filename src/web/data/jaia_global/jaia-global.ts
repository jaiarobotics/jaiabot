import { NodeTypes, SelectedNode } from "../../types/jaia-system-types";

class JaiaGlobal {
    private selectedNode: SelectedNode;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: -1 };
    }

    getSelectedNode() {
        return this.selectedNode;
    }

    setSelectedNode(selectedNode: SelectedNode) {
        if (
            selectedNode.type === this.getSelectedNode().type &&
            selectedNode.id === this.getSelectedNode().id
        ) {
            this.deselectNode();
        } else {
            this.selectedNode = selectedNode;
        }
    }

    deselectNode() {
        this.setSelectedNode({ type: NodeTypes.NONE, id: -1 });
    }
}

export const jaiaGlobal = new JaiaGlobal();

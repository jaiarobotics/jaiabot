import { JaiaSnapshot } from "../../types/context-types";
import { MAX_HISTORY } from "../../utils/constants";
import HistoryStack from "./history-stack";

export class HistoryManager {
    private undoBuffer = new HistoryStack<JaiaSnapshot>(MAX_HISTORY);

    pushUndo(snapshot: JaiaSnapshot) {
        this.undoBuffer.push(snapshot);
    }

    canUndo() {
        return this.undoBuffer.size() > 1;
    }

    undo() {
        const unDoneState = this.undoBuffer.pop();
        // TODO when implementing redo this will be pushed onto redo stack
        return this.undoBuffer.peek();
    }
}

export const historyManager = new HistoryManager();

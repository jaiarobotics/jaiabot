import { JaiaSnapshot } from "../../types/context-types";
import { MAX_HISTORY } from "../../utils/constants";
import HistoryBuffer from "./history-buffer";

export class HistoryManager {
    private undoBuffer = new HistoryBuffer<JaiaSnapshot>(MAX_HISTORY);

    pushUndo(snapshot: JaiaSnapshot) {
        this.undoBuffer.push(snapshot);
    }

    canUndo() {
        return this.undoBuffer.canPop();
    }

    undo() {
        return this.undoBuffer.pop();
    }
}

export const historyManager = new HistoryManager();

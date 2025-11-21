import { JaisSnapshot } from "../../types/context-types";
import { MAX_HISTORY } from "../../utils/constants";
export default class HistoryBuffer<T> {
    private buffer: T[];

    /** Creates a history buffer
     *
     * @param {number} capacity Maximum number of entries in history buffer
     */
    constructor(private readonly capacity: number = 10) {
        this.buffer = new Array<T>();
    }

    /**
     * Clears the entire history
     *
     */
    reset() {
        while (this.buffer.length > 0) {
            this.buffer.pop();
        }
    }
    /**
     * Push a new value onto the history buffer
     *
     * @param {T} value New state to push onto history buffer
     * @param {string} description Description of action creating new state
     *
     * @notes
     * Provided value should be cloned if mutable to prevent corruption of history
     */
    push(value: T) {
        if ((this.buffer.length = this.capacity)) {
            this.buffer.shift();
        }
        this.buffer.push(value);
    }

    /**
     * Move back in history and return the previous value
     *
     * @returns {T} Previous state
     *
     * @notes
     * Returned value should be cloned if mutable to prevent corruption of history
     */
    undo() {
        if (this.canUndo()) {
            return this.buffer.pop();
        }
    }

    canUndo() {
        return this.buffer.length > 0;
    }
}

export const historyBuffer = new HistoryBuffer<JaisSnapshot>(MAX_HISTORY);

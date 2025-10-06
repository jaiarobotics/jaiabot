export default class HistoryBuffer<T> {
    private buffer: Array<{ value: T; description: string } | undefined>;
    private initialValue: T;
    private index: number;
    private head: number;
    private size: number;

    /** Creates a history buffer
     *
     * @param {T} initialValue Initial state of history buffer
     * @param {number} capacity Maximum number of entries in history buffer
     */
    constructor(
        initialValue: T,
        private readonly capacity: number = 10,
    ) {
        this.buffer = new Array(capacity);
        this.initialValue = initialValue;
        const entry = { value: initialValue, description: "Initial State" };
        this.buffer[0] = entry;
        this.index = 0;
        this.head = 0;
        this.size = 1;
    }

    /**
     * Clears the entire history
     *
     * @param {T} initialValue New initial value, will use original if not provided
     * @returns {T} current value of history buffer (initialValue)
     */
    reset(initialValue?: T) {
        this.buffer.fill(undefined);
        this.initialValue = initialValue ?? this.initialValue;
        const entry = { value: this.initialValue, description: "Initial State" };
        this.buffer[0] = entry;
        this.index = 0;
        this.head = 0;
        this.size = 1;
        return this.getPresent();
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
    push(value: T, description: string) {
        const entry = { value, description };

        // Trim redo path if we've undone some entries
        const tail = (this.head + this.size - 1) % this.capacity;
        if (this.index !== tail) {
            this.size =
                (this.index - this.head + 1 + this.capacity) % this.capacity || this.capacity;
        }

        if (this.size < this.capacity) {
            // Buffer not full yet
            const pos = (this.head + this.size) % this.capacity;
            this.buffer[pos] = entry;
            this.index = pos;
            this.size++;
        } else {
            // Buffer full, overwrite oldest
            this.head = (this.head + 1) % this.capacity;
            const pos = (this.head + this.size - 1) % this.capacity;
            this.buffer[pos] = entry;
            this.index = pos;
        }
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
            this.index = (this.index - 1 + this.capacity) % this.capacity;
            return this.getPresent();
        }
    }

    /**
     * Move forward in history and return the next value
     *
     * @returns {T} Next state
     *
     * @notes
     * Returned value should be cloned if mutable to prevent corruption of history
     */
    redo() {
        if (this.canRedo()) {
            this.index = (this.index + 1) % this.capacity;
            return this.getPresent();
        }
    }

    /**
     * Returns current state
     *
     * @returns {T} Current state
     *
     * @notes
     * Returned value should be cloned if mutable to prevent corruption of history
     */
    getPresent() {
        return this.buffer[this.index].value;
    }

    /**
     * Provides description of the last action for undo button tooltip
     *
     * @returns {string} Description of action to be undone
     */
    peekUndoDescription() {
        return this.canUndo() ? this.buffer[this.index].description : "";
    }

    /**
     * Provides description of the next action for redo button tooltip
     *
     * @returns {string} Description of action to be redone
     */
    peekRedoDescription() {
        if (!this.canRedo()) return "";
        const nextIndex = (this.index + 1) % this.capacity;
        return this.buffer[nextIndex]?.description;
    }

    /**
     * Checks if there is anything to undo
     *
     * @returns {boolean} True if undo can be performed
     */
    canUndo() {
        return this.index !== this.head;
    }

    /**
     * Checks if there is anything to redo
     *
     * @returns {boolean} True if redo can be performed
     */
    canRedo() {
        const tail = (this.head + this.size - 1) % this.capacity;
        return this.index !== tail;
    }
}

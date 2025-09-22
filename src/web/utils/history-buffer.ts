export default class HistoryBuffer<T> {
    private buffer: Array<{ value: T; description: string } | undefined>;
    private initialValue: T;
    private index: number;
    private head: number;
    private size: number;

    constructor(
        initialValue: T,
        private readonly capacity: number = 10,
    ) {
        this.buffer = new Array(capacity);
        this.initialValue = initialValue;
        const entry = { value: initialValue, description: "Initial state" };
        this.buffer[0] = entry;
        this.index = 0;
        this.head = 0;
        this.size = 1;
    }

    /** Clear the entire history */
    reset(initialValue?: T) {
        this.buffer.fill(undefined);
        this.initialValue = initialValue ?? this.initialValue;
        const entry = { value: this.initialValue, description: "Initial state" };
        this.buffer[0] = entry;
        this.index = 0;
        this.head = 0;
        this.size = 1;
        return this.getPresent();
    }

    /** Push a new value onto the history buffer */
    push(value: T, description: string) {
        const entry = { value, description };
        if (this.size < this.capacity) {
            // buffer not full yet
            const pos = (this.head + this.size) % this.capacity;
            this.buffer[pos] = entry;
            this.index = pos;
            this.size++;
        } else {
            // buffer full, overwrite oldest
            this.head = (this.head + 1) % this.capacity;
            const pos = (this.head + this.size - 1) % this.capacity;
            this.buffer[pos] = entry;
            this.index = pos;
        }
    }

    /** Undo: move back in history and return the previous value */
    undo() {
        if (this.canUndo()) {
            this.index = (this.index - 1 + this.capacity) % this.capacity;
            return this.getPresent();
        }
    }

    /** Redo: move forward in history and return the next value */
    redo() {
        if (this.canRedo()) {
            this.index = (this.index + 1) % this.capacity;
            return this.getPresent();
        }
    }

    /** Return the current value without changing history */
    getPresent() {
        return this.buffer[this.index].value;
    }

    /** Description of the last action for undo button tooltip */
    peekUndoDescription() {
        return this.canUndo() ? this.buffer[this.index].description : undefined;
    }

    /** Description of the next action for redo button tooltip */
    peekRedoDescription() {
        if (!this.canRedo()) return undefined;
        const nextIndex = (this.index + 1) % this.capacity;
        return this.buffer[nextIndex]?.description;
    }

    /** Can we perform an undo? */
    canUndo() {
        return this.index !== this.head;
    }

    /** Can we perform a redo? */
    canRedo() {
        const tail = (this.head + this.size - 1) % this.capacity;
        return this.size > 0 && this.index !== tail;
    }
}

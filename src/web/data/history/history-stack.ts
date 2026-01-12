export default class HistoryStack<T> {
    private items: T[] = [];
    private capacity: number;

    /** Creates a history stack
     *
     * @param {number} capacity Maximum number of entries in history stack
     */
    constructor(capacity: number = 20, initialEntry?: T) {
        this.capacity = capacity;
        if (initialEntry !== undefined) {
            this.items.push(initialEntry);
        }
    }

    /**
     * Push a new item onto the stack
     *
     * @param {T} item New item to push onto the stack
     *
     */
    push(item: T) {
        if (this.items.length === this.capacity) {
            this.items.shift();
        }
        this.items.push(item);
    }

    /**
     * Returns the last item on the stack and removes it from the stack
     *
     * @returns {T} Previous state
     */
    pop() {
        if (this.canPop()) {
            return this.items.pop();
        }
    }

    /**
     * Returns the last item on the stack
     *
     * @returns {T} Previous state
     */
    peek() {
        if (this.items.length > 0) {
            return this.items[this.items.length - 1];
        }
    }

    /**
     * Returns number of items on the stack
     * @returns {number} number of items on the stack
     */
    size() {
        return this.items.length;
    }

    /**
     * Checks the length of the array to avoid any errors prior to popping
     *
     * @returns {boolean} Whether or not the array length is greater than 0
     */
    canPop() {
        return this.items.length > 0;
    }
}

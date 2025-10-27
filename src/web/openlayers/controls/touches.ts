class Touches {
    private isPanning: boolean;

    constructor() {
        this.isPanning = false;
    }

    getIsPanning() {
        return this.isPanning;
    }

    /**
     * Updates the isPanning property based on the operator's finger movements
     *
     * @param {number} numOfFingers Number of fingers currently touching screen
     * @returns {void}
     *
     * @notes
     * Zero indicates the operator has lifted their fingers from the screen
     */
    updateFingers(numOfFingers: number) {
        if (numOfFingers === 2) {
            this.isPanning = true;
        } else if (numOfFingers === 0) {
            this.isPanning = false;
        }
    }
}

export const touches = new Touches();

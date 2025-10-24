class Touches {
    private isPanning: boolean;

    constructor() {
        this.isPanning = false;
    }

    getIsPanning() {
        return this.isPanning;
    }

    updateFingers(numOfFingers: number) {
        if (numOfFingers === 2) {
            this.isPanning = true;
        } else if (numOfFingers === 0) {
            this.isPanning = false;
        }
    }
}

export const touches = new Touches();

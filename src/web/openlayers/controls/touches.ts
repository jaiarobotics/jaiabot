class Touches {
    private fingers: number[];
    private index: number;
    private readonly LENGTH = 8;

    constructor() {
        this.fingers = [];
        this.index = 0;
    }

    getFingers() {
        return this.fingers;
    }

    updateFingers(numOfFingers: number) {
        this.fingers[this.index] = numOfFingers;
        this.index = (this.index + 1) % this.LENGTH;
    }
}

export const touches = new Touches();

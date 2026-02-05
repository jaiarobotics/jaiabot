export default class PressureSensor {
    private depth: number;

    constructor() {}

    getDepth() {
        return this.depth;
    }

    setDepth(depth: number) {
        this.depth = depth;
    }
}

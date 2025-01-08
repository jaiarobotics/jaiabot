export default class DiveParameters {
    private maxDepth: number;
    private depthInterval: number;
    private holdTime: number;
    private isBottomDive: boolean;

    constructor() {}

    getMaxDepth() {
        return this.maxDepth;
    }

    setMaxDepth(maxDepth: number) {
        this.maxDepth = maxDepth;
    }

    getDepthInterval() {
        return this.depthInterval;
    }

    setDepthInterval(depthInterval: number) {
        this.depthInterval = depthInterval;
    }

    getHoldTime() {
        return this.holdTime;
    }

    setHoldTime(holdTime: number) {
        this.holdTime = holdTime;
    }

    getIsBottomDive() {
        return this.isBottomDive;
    }

    setIsBottomDive(isBottomDive: boolean) {
        this.isBottomDive = isBottomDive;
    }
}

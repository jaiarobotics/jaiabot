export default class ConstantHeadingParameters {
    private heading: number;
    private time: number;
    private speed: number;

    constructor() {}

    getHeading() {
        return this.heading;
    }

    setHeading(heading: number) {
        this.heading = heading;
    }

    getTime() {
        return this.time;
    }

    setTime(time: number) {
        this.time = time;
    }

    getSpeed() {
        return this.speed;
    }

    setSpeed(speed: number) {
        this.speed = speed;
    }
}

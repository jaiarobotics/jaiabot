export default class IMU {
    private heading: number;
    private pitch: number;
    private roll: number;
    private calibrationStatus: number;

    constructor() {}

    getHeading() {
        return this.heading;
    }

    setHeading(heading: number) {
        this.heading = heading;
    }

    getPitch() {
        return this.pitch;
    }

    setPitch(pitch: number) {
        this.pitch = pitch;
    }

    getRoll() {
        return this.roll;
    }

    setRoll(roll: number) {
        this.roll = roll;
    }

    getCalibrationStatus() {
        return this.calibrationStatus;
    }

    setCalibrationStatus(calibrationStatus: number) {
        this.calibrationStatus = calibrationStatus;
    }
}

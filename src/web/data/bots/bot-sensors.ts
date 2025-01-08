import GPS from "../sensors/gps";
import IMU from "../sensors/imu";
import Pressure from "../sensors/pressure";
import Temperature from "../sensors/temperature";
import Conductivity from "../sensors/conductivity";

export default class BotSensors {
    private gps: GPS;
    private imu: IMU;
    private pressure: Pressure;
    private temperature: Temperature;
    private conductivity: Conductivity;

    constructor() {
        this.initBaseSensors();
    }

    initBaseSensors() {
        this.gps = new GPS();
        this.imu = new IMU();
        this.pressure = new Pressure();
        this.temperature = new Temperature();
        this.conductivity = new Conductivity();
    }

    initPAMSensors() {}

    getGPS() {
        return this.gps;
    }

    getIMU() {
        return this.imu;
    }

    getPressure() {
        return this.pressure;
    }

    getTemperature() {
        return this.temperature;
    }

    getCoductivity() {
        return this.conductivity;
    }
}

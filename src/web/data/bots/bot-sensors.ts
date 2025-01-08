import GPS from "../sensors/gps";
import IMU from "../sensors/imu";
import PressureSensor from "../sensors/pressure";
import TemperatureSensor from "../sensors/temperature";
import ConductivitySensor from "../sensors/conductivity";

export default class BotSensors {
    private gps: GPS;
    private imu: IMU;
    private pressureSensor: PressureSensor;
    private temperatureSensor: TemperatureSensor;
    private conductivitySensor: ConductivitySensor;

    constructor() {
        this.initBaseSensors();
    }

    initBaseSensors() {
        this.gps = new GPS();
        this.imu = new IMU();
        this.pressureSensor = new PressureSensor();
        this.temperatureSensor = new TemperatureSensor();
        this.conductivitySensor = new ConductivitySensor();
    }

    initPAMSensors() {}

    getGPS() {
        return this.gps;
    }

    getIMU() {
        return this.imu;
    }

    getPressureSensor() {
        return this.pressureSensor;
    }

    getTemperatureSensor() {
        return this.temperatureSensor;
    }

    getCoductivitySensor() {
        return this.conductivitySensor;
    }
}

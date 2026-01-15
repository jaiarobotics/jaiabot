export default class TemperatureSensor {
    private temperature: number;

    constructor() {}

    getTemperature() {
        return this.temperature;
    }

    setTemperature(temperature: number) {
        this.temperature = temperature;
    }
}

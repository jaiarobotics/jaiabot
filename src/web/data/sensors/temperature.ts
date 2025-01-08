export default class Temperature {
    private temperature: number;

    constructor() {}

    getTemperature() {
        return this.temperature;
    }

    setTemperature(temperature: number) {
        this.temperature = temperature;
    }
}

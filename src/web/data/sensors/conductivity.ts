export default class Conductivity {
    private salinity: number;

    constructor() {}

    getSalinity() {
        return this.salinity;
    }

    setSalinity(salinity: number) {
        this.salinity = salinity;
    }
}

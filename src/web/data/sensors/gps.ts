export default class GPS {
    private lat: number;
    private lon: number;
    private hdop: number;
    private pdop: number;
    private speedOverGround: number;
    private courseOverGround: number;

    constructor() {}

    getLat() {
        return this.lat;
    }

    setLat(lat: number) {
        this.lat = lat;
    }

    getLon() {
        return this.lon;
    }

    setLon(lon: number) {
        this.lon = lon;
    }

    getHDOP() {
        return this.hdop;
    }

    setHDOP(hdop: number) {
        this.hdop = hdop;
    }

    getPDOP() {
        return this.pdop;
    }

    setPDOP(pdop: number) {
        this.pdop = pdop;
    }

    getSpeedOverGround() {
        return this.speedOverGround;
    }

    setSpeedOverGround(speedOverGround: number) {
        this.speedOverGround = speedOverGround;
    }

    getCourseOverGround() {
        return this.courseOverGround;
    }

    setCourseOverGround(courseOverGround: number) {
        this.courseOverGround = courseOverGround;
    }
}

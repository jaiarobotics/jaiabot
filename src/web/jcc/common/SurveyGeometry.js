const { getCoordsFromHeadingAndDistance, getHeadingAndDistanceFromCoords } = require("./GeoMath");
const FormationGeometry = require("./FormationGeometry");

module.exports = class RectangleSurveyGeometry {
    constructor(center, height, width, heading, separation, botCount = 10) {
        this.center = center; // Center [Long, Lat]
        this.height = height; // Meters
        this.width = width; // Meters
        this.heading = heading; // Rotation in degrees
        this.horizSeparation = separation; // Separation in one axis. The other axis is determined by number of bots
        this.botCount = botCount;
        this.formationCount = Math.ceil(this.width / this.horizSeparation);
        this.vertSeparation = this.height / this.botCount;
    }

    // Returns a list/array of FormationGeometrys
    getFormations() {
        const centerLeftPoint = getCoordsFromHeadingAndDistance(
            this.center,
            this.heading - 90,
            this.width / 2.0,
        );
        const bottomLeftPoint = getCoordsFromHeadingAndDistance(
            centerLeftPoint,
            this.heading + 180,
            this.height / 2.0,
        );
        const formations = [];
        for (let i = 0; i < this.formationCount; i += 1) {
            const origin = getCoordsFromHeadingAndDistance(
                bottomLeftPoint,
                this.heading + 90,
                this.horizSeparation * i,
            );
            const formation = new FormationGeometry(
                origin,
                this.heading,
                this.vertSeparation,
                "line",
                this.botCount,
            );
            formations.push(formation);
        }
        return formations;
    }

    getParams() {
        const params = [];
        const centerLeftPoint = getCoordsFromHeadingAndDistance(
            this.center,
            this.heading - 90,
            this.width / 2.0,
        );
        const bottomLeftPoint = getCoordsFromHeadingAndDistance(
            centerLeftPoint,
            this.heading + 180,
            this.height / 2.0,
        );
        for (let i = 0; i < this.formationCount; i += 1) {
            const origin = getCoordsFromHeadingAndDistance(
                bottomLeftPoint,
                this.heading + 90,
                this.horizSeparation * i,
            );
            // lat, lon, bearing, sep
            params.push([origin[1], origin[0], this.heading, this.vertSeparation]);
        }
        return params;
    }
};

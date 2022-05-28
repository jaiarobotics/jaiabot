const { getCoordsFromHeadingAndDistance, getHeadingAndDistanceFromCoords } = require('./GeoMath');

module.exports = class FormationGeometry {
  constructor(coords, heading, separation, shape = 'line', botCount = 10) {
    this.origin = coords;
    this.heading = heading;
    this.distance = FormationGeometry.applySpacingEncodeError(separation);
    this.shape = shape;
    this.botCount = botCount;
  }

  getBotCoords(index) {
    switch (this.shape) {
      case 'circle':
        return getCoordsFromHeadingAndDistance(
          this.origin,
          this.heading + index * (360 / this.botCount),
          this.distance
        );
      case 'line':
      default:
        return getCoordsFromHeadingAndDistance(this.origin, this.heading, this.distance * index);
    }
  }

  static applySpacingEncodeError(spacing) {
    const dm = Math.round(spacing * 10);
    const sq = Math.round(Math.sqrt(dm));
    const dec = sq ** 2;
    return dec / 10;
  }
};

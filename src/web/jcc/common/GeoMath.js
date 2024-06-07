/* eslint-disable no-bitwise */
const GeographicLib = require("geographiclib");

const geodesic = GeographicLib.Geodesic.WGS84;

function getCoordsFromHeadingAndDistance(coords1, azi1, s12) {
    if (s12 === 0) return coords1;
    const lat1 = coords1[1];
    const lon1 = coords1[0];
    // azi1 = α1, azimuth of line at point 1 (degrees)
    // s12 = s12, distance from 1 to 2 (meters)
    const { lat2, lon2 } = geodesic.Direct(
        lat1,
        lon1,
        azi1,
        s12,
        geodesic.LATITUDE | geodesic.LONGITUDE | geodesic.DISTANCE_IN,
    );
    return [lon2, lat2];
}

function getHeadingAndDistanceFromCoords(coords1, coords2) {
    const lat1 = coords1[1];
    const lon1 = coords1[0];
    const lat2 = coords2[1];
    const lon2 = coords2[0];
    // azi1 = α1, azimuth of line at point 1 (degrees)
    // s12 = s12, distance from 1 to 2 (meters)
    const { azi1, s12, azi2 } = geodesic.Inverse(
        lat1,
        lon1,
        lat2,
        lon2,
        geodesic.AZIMUTH | geodesic.DISTANCE,
    );
    return { azi1, s12, azi2 };
}

const AngDiff = (a, b) => {
    const x = (a * Math.PI) / 180.0;
    const y = (b * Math.PI) / 180.0;
    return (Math.atan2(Math.sin(x - y), Math.cos(x - y)) * 180.0) / Math.PI;
};

module.exports = {
    getCoordsFromHeadingAndDistance,
    getHeadingAndDistanceFromCoords,
    AngDiff,
};

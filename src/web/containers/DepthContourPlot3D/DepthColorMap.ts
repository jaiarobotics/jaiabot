import cm_data from "./colorData.json";

export function getColorScale() {
    const N = Math.max(2, cm_data.length);
    return cm_data.map((rgb, index) => [index / (N - 1), `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`]);
}

import colors from "./colors.json";

export function getColorScale() {
    const n = Math.max(2, colors.length);
    return colors.map((rgb, index) => [index / (n - 1), `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`]);
}

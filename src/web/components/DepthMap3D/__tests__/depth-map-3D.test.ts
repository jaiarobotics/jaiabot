import { getColorScale, getDepthIntensities } from "../depth-map-3D";

describe("getColorScale", () => {
    test("gives CSS rgb() colors on the 0-255 scale, from the deepest color to the shallowest", () => {
        const colorScale = getColorScale();

        expect(colorScale[0]).toEqual([0, "rgb(40,26,44)"]);
        expect(colorScale.at(-1)[0]).toBe(1);
        const channels = colorScale.flatMap(([, color]) =>
            color.match(/\d+/g).map((channel) => Number(channel)),
        );
        expect(Math.max(...channels)).toBeGreaterThan(200);
        expect(channels.every((channel) => Number.isInteger(channel) && channel <= 255)).toBe(true);
    });
});

describe("getDepthIntensities", () => {
    test("scales a spread of depths from 0 (deepest) to 1 (shallowest)", () => {
        expect(getDepthIntensities([-10, -5, -15])).toEqual([0.5, 1, 0]);
    });

    test("returns 0 rather than NaN for a single depth", () => {
        expect(getDepthIntensities([-7])).toEqual([0]);
    });

    test("returns all zeros when every depth is the same", () => {
        expect(getDepthIntensities([-7, -7, -7])).toEqual([0, 0, 0]);
    });
});

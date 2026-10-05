import { getDepthIntensities } from "../depth-map-3D";

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

import { OSMLayer } from "../tile/osm-layer";
import { NaturalEarthLayer } from "../tile/natural-earth-layer";
import { fallBackToNaturalEarthWithoutInternet } from "../tile/base-map-fallback";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";

describe("fallBackToNaturalEarthWithoutInternet", () => {
    beforeEach(() => {
        OSMLayer.setVisible(true);
        NaturalEarthLayer.setVisible(false);
    });

    test("keeps OpenStreetMap with internet", () => {
        jaiaGlobal.setIsConnectedToInternet(true);
        fallBackToNaturalEarthWithoutInternet();
        expect(OSMLayer.getVisible()).toBe(true);
        expect(NaturalEarthLayer.getVisible()).toBe(false);
    });

    test("switches to Natural Earth without internet", () => {
        jaiaGlobal.setIsConnectedToInternet(false);
        fallBackToNaturalEarthWithoutInternet();
        expect(OSMLayer.getVisible()).toBe(false);
        expect(NaturalEarthLayer.getVisible()).toBe(true);
    });

    test("leaves a base map the operator picked alone", () => {
        OSMLayer.setVisible(false);
        jaiaGlobal.setIsConnectedToInternet(false);
        fallBackToNaturalEarthWithoutInternet();
        expect(OSMLayer.getVisible()).toBe(false);
        expect(NaturalEarthLayer.getVisible()).toBe(false);
    });
});

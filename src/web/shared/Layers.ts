import TileLayer from "ol/layer/Tile";
import SourceXYZ from "ol/source/XYZ";

export function getArcGISSatelliteImageryLayer() {
    return new TileLayer({
        properties: {
            title: "ArcGIS Satellite Imagery",
            type: "base",
        },
        zIndex: 1,
        source: new SourceXYZ({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attributions:
                "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community, ESRI",
            attributionsCollapsible: false,
        }),
    });
}

import Style from "ol/style/Style";
import { Feature, Map } from "ol";
import { Point } from "ol/geom";
interface MarkerParameters {
    lon: number;
    lat: number;
    popupHTML?: string;
    title?: string;
    style?: Style;
}
export declare function createMarker(map: Map, parameters: MarkerParameters): Feature<Point>;
export declare function createFlagMarker(map: Map, parameters: MarkerParameters): Feature<Point>;
export declare function createGPSMarker(map: Map, parameters: MarkerParameters): Feature<Point>;
export {};

import { KML } from 'ol/format';
import { Type } from "ol/format/Feature";
export declare class KMZ extends KML {
    constructor(inputOptions: any);
    getType(): Type;
    readFeature(source: any, options: any): import("ol/Feature").default<import("ol/geom/Geometry").default>;
    readFeatures(source: any, options: any): import("ol/Feature").default<import("ol/geom/Geometry").default>[];
}

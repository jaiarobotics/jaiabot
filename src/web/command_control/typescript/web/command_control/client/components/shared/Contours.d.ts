import { ProjectionLike } from 'ol/proj';
export declare function geoJSONToDepthContourFeatures(projection: ProjectionLike, geojson: object): import("ol/Feature").default<import("ol/geom/Geometry").default>[];
export declare function geoJSONToFeatures(projection: ProjectionLike, geojson: object): import("ol/Feature").default<import("ol/geom/Geometry").default>[];

import { Vector as OlVectorSource } from "ol/source";
import { Draw as OlDrawInteraction } from "ol/interaction";
import { EventsKey } from "ol/events";
import { Map as OlMap } from "ol";
import { Vector as OlVectorLayer } from "ol/layer";
export declare class SurveyExclusions {
    map: OlMap;
    didChange: (surveyExclusions?: number[][]) => void;
    source: OlVectorSource<import("ol/geom/Geometry").default>;
    interaction: OlDrawInteraction;
    listener: EventsKey;
    layer: OlVectorLayer<OlVectorSource<import("ol/geom/Geometry").default>>;
    constructor(map: OlMap, didChange: (surveyExclusions: number[][]) => void);
}

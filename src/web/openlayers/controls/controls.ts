import { Zoom, Rotate, ScaleLine, Attribution } from "ol/control";

export const controls = [
    new Zoom(),
    new Rotate(),
    new ScaleLine({ units: "metric" }),
    new Attribution({
        collapsible: false,
    }),
];

import { Zoom, Rotate, ScaleLine, Attribution, MousePosition } from "ol/control";
import { createStringXY } from "ol/coordinate";
import { mdiMinus, mdiPlus, mdiRotate3dVariant } from "@mdi/js";
import { EQUIRECTANGULAR, LAT_LON_DECIMALS } from "../../utils/constants";

export const controls = [
    new Zoom(),
    new Rotate(),
    new ScaleLine({ units: "metric" }),
    new MousePosition({
        coordinateFormat: createStringXY(LAT_LON_DECIMALS),
        projection: EQUIRECTANGULAR,
    }),
    new Attribution({
        collapsible: false,
    }),
];

const zoomInSVG = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" role="img" aria-label="zoom-in">
        <path d="${mdiPlus}"></path>
    </svg>
`;

const zoomOutSVG = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" role="img" aria-label="zoom-out">
        <path d="${mdiMinus}"></path>
    </svg>
`;

const rotateSVG = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" role="img" aria-label="rotate-north">
        <path d="${mdiRotate3dVariant}"></path>
    </svg>
`;

/**
 * Applies the jaia-button style to the map control buttons and attaches a MDI icon
 *
 * @returns {void}
 */
export function styleControlButtons() {
    const buttons = document.querySelectorAll(".ol-zoom-in, .ol-zoom-out, .ol-rotate-reset");
    buttons.forEach((button) => {
        button.classList.add("jaia-button", "ol-control-button");
        button.removeChild(button.firstChild);
        if (button.classList.contains("ol-zoom-in")) {
            button.innerHTML = zoomInSVG;
        } else if (button.classList.contains("ol-zoom-out")) {
            button.innerHTML = zoomOutSVG;
        } else if (button.classList.contains("ol-rotate-reset")) {
            button.innerHTML = rotateSVG;
        }
    });
}

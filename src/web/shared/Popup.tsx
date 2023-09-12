import { Overlay } from "ol";
import Map from "ol/Map"
import Feature from "ol/Feature"
import OlMapBrowserEvent from "ol/MapBrowserEvent"

/*
Add an html element as a popup to the OpenLayers feature
*/
export function addPopup(map: Map, feature: Feature, popupElement: HTMLElement) {

    /**
     * Create an overlay to anchor the popup to the map.
     */
    const overlay = new Overlay({
        element: popupElement,
        autoPan: {
            animation: {
            duration: 250,
            },
        },
    });

    /**
     * Add a click handler to hide the popup.
     * @return {boolean} Don't follow the href.
     */
    popupElement.onclick = function () {
        map.removeOverlay(overlay)
        return false;
    };

    feature.set('onclick', function (evt: OlMapBrowserEvent<UIEvent>) {
        const overlayOffsetPixels = [50, 0]

        const clickCoordinate = evt.coordinate;
        const clickPixelCoordinate = map.getPixelFromCoordinate(clickCoordinate)
        const overlayPixelCoordinate = [clickPixelCoordinate[0] + overlayOffsetPixels[0], clickPixelCoordinate[1] + overlayOffsetPixels[1]]
        const overlayCoordinate = map.getCoordinateFromPixel(overlayPixelCoordinate)

        overlay.setPosition(overlayCoordinate);
        map.getOverlays().clear()
        map.addOverlay(overlay)
    });

    console.log(`Added popup for ${feature.getId()}: ${popupElement.innerHTML}`)

}

export function addPopupHTML(map: Map, feature: Feature, popupHTML: string) {
    var popupElement = document.createElement('div') as HTMLDivElement
    popupElement.classList.add("popup")
    popupElement.innerHTML = popupHTML

    addPopup(map, feature, popupElement)
}

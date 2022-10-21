import { Overlay } from "ol";

/*
Add an html element as a popup to the OpenLayers feature
*/
export function addPopup(map, feature, popupElement) {

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

    feature.set('onclick', function (evt) {
        console.log(evt)
        const coordinate = evt.coordinate;
        overlay.setPosition(coordinate);
        map.addOverlay(overlay)
    });

}

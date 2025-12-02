import { useContext, useState, ChangeEvent, useEffect } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import JaiaToggle from "../../JaiaToggle/JaiaToggle";
import { MapModes } from "../../../types/openlayers-types";
import { CoordinateTypes } from "../../../types/jaia-system-types";
import { DEFAULT_HUB_ID, LAT_LON_DECIMALS } from "../../../utils/constants";
import { validateCoordinate } from "../../../utils/input";

import "./MoveHub.less";

/**
 * Renders the section that allows an operator to change the location of
 * the Hub in simulation
 */
export default function MoveHub() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Provides the latitude and longitude of the Hub in string form
     *
     * @param {CoordinateTypes} coordType Whether to return lat or lon
     * @returns {string} Latitude or longitude point (0 if not available)
     */
    const getHubLocation = (coordType: CoordinateTypes) => {
        const hub = jaiaContext.hubs.getHub(DEFAULT_HUB_ID);

        if (hub && hub.getLocation()) {
            if (coordType === CoordinateTypes.LAT) {
                return hub.getLocation().lat.toFixed(LAT_LON_DECIMALS);
            } else {
                return hub.getLocation().lon.toFixed(LAT_LON_DECIMALS);
            }
        }

        return "0";
    };

    const [latInput, setLatInput] = useState(getHubLocation(CoordinateTypes.LAT));
    const [lonInput, setLonInput] = useState(getHubLocation(CoordinateTypes.LON));

    useEffect(() => {
        if (jaiaContext.jaiaGlobal.getMapMode() === MapModes.HUB_LOCATION_SELECT) {
            setLatInput(getHubLocation(CoordinateTypes.LAT));
            setLonInput(getHubLocation(CoordinateTypes.LON));
        }
    });

    /**
     * Dispatches action to update the map mode and
     * change the state of the toggle
     *
     * @returns {void}
     */
    const handleSelectOnMapClick = () => {
        jaiaDispatch({ type: JaiaActions.TOGGLE_SELECT_HUB_LOCATION });
    };

    /**
     * Updates the local copy of the coordinate on each key stroke. If the
     * coordinate is a number, the data model and OpenLayers will be updated.
     * If not, only the input field will change.
     *
     * @param {ChangeEvent} evt Contains the coord type + value
     * @returns {void}
     */
    const handleCoordinateChange = (evt: ChangeEvent<HTMLInputElement>) => {
        let lat = latInput;
        let lon = lonInput;

        const value = evt.target.value;

        if (evt.target.name === CoordinateTypes.LAT) {
            setLatInput(value);
            lat = value;
        } else {
            setLonInput(value);
            lon = value;
        }

        if (isNaN(Number(value))) {
            return;
        }

        // Turn off select on map to prevent the Hub's current location from
        // overwriting the operator's changes to the input
        if (jaiaContext.jaiaGlobal.getMapMode() === MapModes.HUB_LOCATION_SELECT) {
            jaiaDispatch({ type: JaiaActions.TOGGLE_SELECT_HUB_LOCATION });
        }

        const updatedLatLon = validateCoordinate(lat, lon);
        setLatInput(updatedLatLon[0]);
        setLonInput(updatedLatLon[1]);
        jaiaDispatch({
            type: JaiaActions.MOVE_HUB,
            location: { lat: Number(updatedLatLon[0]), lon: Number(updatedLatLon[1]) },
        });
    };

    return (
        <div className="move-hub">
            <div className="heading">Move Hub</div>
            <div className="toggle-container">
                <div>Select on Map:</div>
                <JaiaToggle
                    checked={() =>
                        jaiaContext.jaiaGlobal.getMapMode() === MapModes.HUB_LOCATION_SELECT
                    }
                    onClick={() => handleSelectOnMapClick()}
                />
            </div>
            <div className="location-input-container">
                <div>Lat:</div>
                <input
                    className="jaia-input"
                    name={CoordinateTypes.LAT}
                    value={latInput}
                    onChange={(evt) => handleCoordinateChange(evt)}
                />
                <div>Lon:</div>
                <input
                    className="jaia-input"
                    name={CoordinateTypes.LON}
                    value={lonInput}
                    onChange={(evt) => handleCoordinateChange(evt)}
                />
            </div>
        </div>
    );
}

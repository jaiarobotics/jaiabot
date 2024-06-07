// React
import React, { useState, useEffect, useRef } from "react";

// OpenLayers
import { Map } from "ol";
import PointerInteraction from "ol/interaction/Pointer";

// Jaia
import { JaiaAPI } from "../../common/JaiaAPI";
import { PortalHubStatus } from "./shared/PortalStatus";
import { CommandForHub, GeographicCoordinate, HubCommandType } from "./shared/JAIAProtobuf";
import { getElementById, getGeographicCoordinate } from "./shared/Utilities";

// Style
import Button from "@mui/material/Button";
import { Select, MenuItem } from "@mui/material";
import "../style/components/SetHubLocation.less";

interface Props {
    hubs: { [key: number]: PortalHubStatus };
    api: JaiaAPI;
    map: Map;
}

export default function SetHubLocation(props: Props) {
    const [hubId, setHubId] = useState(Number(Object.keys(props.hubs)[0]) ?? 1);
    const [selectingOnMap, setSelectingOnMap] = useState(false);
    const selectOnMapInteractionRef = useRef(null);
    const latitudeInputElementRef = useRef<HTMLInputElement>();
    const longitudeInputElementRef = useRef<HTMLInputElement>();

    const hubLocation = props.hubs[hubId].location;

    /**
     * A Select element for choosing the hub_id.
     *
     * @returns {React.JSX.Element[]} The Select element.
     *
     * @notes Would be used in a multi-hub simulation environment.
     */
    function hubIdSelectionElement(): React.JSX.Element[] {
        const menuItems = Object.values(props.hubs).map((hub) => {
            return <MenuItem value={hub.hub_id}>{`Hub ${hub.hub_id}`}</MenuItem>;
        });

        const labelRow = <div className="mission-settings-input-label">Hub ID</div>;

        const hubIdSelectionRow = (
            <div className="mission-settings-input-row">
                <Select
                    id="bot-id-select"
                    defaultValue={hubId}
                    onChange={(evt) => {
                        setHubId(Number(evt.target.value));
                    }}
                >
                    {menuItems}
                </Select>
            </div>
        );

        return [labelRow, hubIdSelectionRow];
    }

    /**
     * Gets the hub location from the text inputs.
     *
     * @returns {GeographicCoordinate | null} Hub location or null (if invalid value entered).
     */
    function getInputHubLocation(): GeographicCoordinate {
        const lat = Number(latitudeInputElementRef.current.value);
        const lon = Number(longitudeInputElementRef.current.value);
        if (isNaN(lat) || isNaN(lon)) {
            return null;
        }

        return {
            lat: lat,
            lon: lon,
        };
    }

    /**
     * Calls the API to submit a location change for a certain hub.
     *
     */
    function submitHubLocation() {
        const hubLocation = getInputHubLocation();

        if (hubLocation === null) {
            console.warn("Hub location is null");
            return;
        }

        const hubCommand: CommandForHub = {
            hub_id: hubId,
            type: HubCommandType.SET_HUB_LOCATION,
            hub_location: hubLocation,
        };

        props.api.postCommandForHub(hubCommand);
    }

    /**
     * Initiate a PointerInteraction to select a new hub location with a click or tap.
     *
     * @returns {void}
     *
     */
    const toggleSelectOnMapInteraction = () => {
        if (selectOnMapInteractionRef.current !== null) {
            destroySelectOnMapInteraction();
            return;
        }

        selectOnMapInteractionRef.current = new PointerInteraction({
            handleEvent: (evt) => {
                if (evt.type == "click") {
                    const clickedLocation = getGeographicCoordinate(evt.coordinate, evt.map);
                    latitudeInputElementRef.current.value = clickedLocation.lat.toFixed(6);
                    longitudeInputElementRef.current.value = clickedLocation.lon.toFixed(6);
                    submitHubLocation();
                    destroySelectOnMapInteraction();
                    // Return false to prevent other interactions from being affected by this click.
                    return false;
                } else {
                    // Let this event fall through to the other interactions on the stack.
                    return true;
                }
            },
        });
        setSelectingOnMap(true);
        props.map.addInteraction(selectOnMapInteractionRef.current);
        props.map.getTargetElement().style.cursor = "crosshair";
    };

    /**
     * Destroy the hub location selection interaction.
     */
    const destroySelectOnMapInteraction = () => {
        if (selectOnMapInteractionRef.current !== null) {
            props.map.removeInteraction(selectOnMapInteractionRef.current);
            selectOnMapInteractionRef.current = null;
            props.map.getTargetElement().style.cursor = "default";
            setSelectingOnMap(false);
        }
    };

    // Destroy the map select interaction on unmount, if present.
    useEffect(() => {
        return destroySelectOnMapInteraction;
    }, []);

    return (
        <div id="set-hub-location" className="panel" key="set-hub-location">
            <div className="panel-heading">Set Hub Location</div>
            <div className="mission-settings-panel-container">
                {/* this.hubIdSelectionElement() */}

                <div className="mission-settings-input-label">Latitude</div>
                <input
                    className="mission-settings-num-input"
                    id="set-hub-location-latitude"
                    ref={latitudeInputElementRef}
                    name="latitude"
                    defaultValue={hubLocation.lat.toFixed(6)}
                />

                <div className="mission-settings-input-label">Longitude</div>
                <input
                    className="mission-settings-num-input"
                    id="set-hub-location-longitude"
                    name="longitude"
                    ref={longitudeInputElementRef}
                    defaultValue={hubLocation.lon.toFixed(6)}
                />
            </div>
            <Button
                className="button-jcc"
                type="button"
                id="set-hub-location-submit"
                onClick={submitHubLocation}
            >
                Submit Values
            </Button>
            <Button
                className={"button-jcc" + (selectingOnMap ? " selected" : "")}
                type="button"
                id="set-hub-location-map-select"
                onClick={toggleSelectOnMapInteraction}
            >
                Select on Map
            </Button>
        </div>
    );
}

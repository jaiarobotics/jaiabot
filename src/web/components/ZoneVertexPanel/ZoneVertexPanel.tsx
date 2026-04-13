import cloneDeep from "lodash/cloneDeep";
import { ChangeEvent, useContext, useEffect, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import JaiaToggle from "../JaiaToggle/JaiaToggle";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

import { validateCoordinate } from "../../utils/input";

import { PanelActions } from "../../types/context-types";
import { CoordinateTypes } from "../../types/jaia-system-types";
import { MapModes } from "../../types/openlayers-types";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";
import { Button } from "@mui/material";

import "./ZoneVertexPanel.less";

// Stored outside of component to prevent unnecessary resetting of variable
let originalSelectedZoneVertex = { ...jaiaGlobal.getSelectedZoneVertex() };

/**
 * Displays information about the selected zone vertex such as location
 */
export default function ZoneVertexPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Gets the selected zone vertex data
     */
    const getSelectedZoneVertex = () => {
        return jaiaContext.jaiaGlobal.getSelectedZoneVertex();
    };

    /**
     * Gets the zone that contains the selected vertex
     */
    const getZone = () => {
        const selectedVertex = getSelectedZoneVertex();
        if (!selectedVertex) return undefined;
        return jaiaContext.exclusionZoneSet.getZone(selectedVertex.zoneID);
    };

    /**
     * Gets the vertex coordinates
     */
    const getVertexLocation = () => {
        const selectedVertex = getSelectedZoneVertex();
        const zone = getZone();
        if (
            !selectedVertex ||
            !zone ||
            !zone.vertices ||
            selectedVertex.vertexIndex >= zone.vertices.length
        ) {
            return { lat: 0, lon: 0 };
        }
        const vertex = zone.vertices[selectedVertex.vertexIndex];
        return { lat: vertex.lat, lon: vertex.lon };
    };

    const [latInput, setLatInput] = useState(getVertexLocation().lat.toString());
    const [lonInput, setLonInput] = useState(getVertexLocation().lon.toString());
    // Snapshot of all zone vertices captured when the panel first opens for this zone.
    // Keyed by zoneID so it resets when the operator switches to a different zone.
    const [priorZoneID, setPriorZoneID] = useState<number | null>(null);
    const [priorZoneVertices, setPriorZoneVertices] = useState(null);

    useEffect(() => {
        const currentVertex = jaiaContext.jaiaGlobal.getSelectedZoneVertex();
        const currentZoneID = currentVertex?.zoneID ?? null;

        // Snapshot the whole zone on first open (or when switching to a different zone).
        if (priorZoneID !== currentZoneID) {
            setPriorZoneID(currentZoneID);
            const zone = getZone();
            setPriorZoneVertices(zone?.vertices ? cloneDeep(zone.vertices) : null);
        }

        // Update input fields whenever the selected vertex changes (index or zone).
        if (!compareSelectedZoneVertices(originalSelectedZoneVertex, currentVertex)) {
            originalSelectedZoneVertex = { ...currentVertex };
            const location = getVertexLocation();
            setLatInput(location.lat.toString());
            setLonInput(location.lon.toString());
        }
    });

    /**
     * Compares two selected zone vertex objects
     */
    const compareSelectedZoneVertices = (a: any, b: any) => {
        return a?.zoneID === b?.zoneID && a?.vertexIndex === b?.vertexIndex;
    };

    /**
     * Compares the lat stored in state and context. If the value in context
     * is different, the vertex has moved via a mechanism outside of the input box
     * such as "tap to move". The function syncs the two sources.
     */
    const getLatInput = () => {
        const location = getVertexLocation();

        if (isNaN(Number(latInput))) {
            return latInput;
        }

        if (location.lat !== Number(latInput)) {
            const updatedLat = location.lat.toString();
            setLatInput(updatedLat);
            return updatedLat;
        }

        return latInput;
    };

    /**
     * Compares the lon stored in state and context. If the value in context
     * is different, the vertex has moved via a mechanism outside of the input box
     * such as "tap to move". The function syncs the two sources.
     */
    const getLonInput = () => {
        const location = getVertexLocation();

        if (isNaN(Number(lonInput))) {
            return lonInput;
        }

        if (location.lon !== Number(lonInput)) {
            const updatedLon = location.lon.toString();
            setLonInput(updatedLon);
            return updatedLon;
        }

        return lonInput;
    };

    /**
     * Updates the coordinate input fields and dispatches a vertex move when
     * both lat and lon are valid numbers (mirrors WaypointPanel's approach).
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

        const updatedLatLon = validateCoordinate(lat, lon);
        setLatInput(updatedLatLon[0]);
        setLonInput(updatedLatLon[1]);

        const selectedVertex = getSelectedZoneVertex();
        if (!selectedVertex) return;

        jaiaDispatch({
            type: JaiaActions.MOVE_ZONE_VERTEX,
            zoneID: selectedVertex.zoneID,
            vertexIndex: selectedVertex.vertexIndex,
            location: { lat: Number(updatedLatLon[0]), lon: Number(updatedLatLon[1]) },
        });
    };

    /**
     * Dispatches action to toggle the zone edit mode
     */
    const handleEditZoneClick = () => {
        const selectedVertex = getSelectedZoneVertex();
        jaiaDispatch({
            type: JaiaActions.TOGGLE_ZONE_EDIT_MODE,
            zoneID: selectedVertex.zoneID,
        });
    };

    /**
     * Dispatches action to toggle tap to move for the vertex
     */
    const handleTapToMoveClick = () => {
        jaiaDispatch({
            type: JaiaActions.TOGGLE_ZONE_VERTEX_TAP_TO_MOVE,
        });
    };

    /**
     * Checks if tap to move should be disabled
     */
    const isTapToMoveDisabled = () => {
        if (jaiaContext.jaiaGlobal.getMapMode() === MapModes.CONSTANT_HEADING_SELECT) {
            return true;
        }
        const selectedVertex = getSelectedZoneVertex();
        return jaiaContext.jaiaGlobal.getZoneInEditMode() !== selectedVertex.zoneID;
    };

    /**
     * Handles deleting the vertex
     */
    const handleDeleteVertex = () => {
        const selectedVertex = getSelectedZoneVertex();
        jaiaDispatch({
            type: JaiaActions.DELETE_ZONE_VERTEX,
            zoneID: selectedVertex.zoneID,
            vertexIndex: selectedVertex.vertexIndex,
        });
    };

    /**
     * Handles closing the panel
     */
    const handleClosePanelClick = (panelAction: PanelActions) => {
        const selectedVertex = getSelectedZoneVertex();
        jaiaDispatch({
            type: JaiaActions.CLOSED_ZONE_VERTEX_PANEL,
            panelAction: panelAction,
            zoneID: selectedVertex?.zoneID,
            // On cancel, pass the full pre-edit vertex snapshot so the handler can restore
            // the whole zone without being confused by hull reindexing.
            locations: panelAction === PanelActions.CANCEL ? priorZoneVertices : undefined,
        });
    };

    const selectedVertex = getSelectedZoneVertex();
    const zone = getZone();

    if (!selectedVertex || !zone) {
        return null;
    }

    const isDisabled = jaiaContext.jaiaGlobal.getZoneInEditMode() !== selectedVertex.zoneID;

    return (
        <div className="zone-vertex-panel-container">
            <div className="zone-vertex-panel">
                <div className="label">Vertex:</div>
                <div className="zone-vertex-input-container">
                    <div>{selectedVertex.vertexIndex + 1}</div>
                    <Button
                        className={`jaia-button delete-vertex ${isDisabled ? "disabled" : ""}`}
                        onClick={handleDeleteVertex}
                        disabled={isDisabled || zone.vertices.length <= 3}
                    >
                        <Icon path={mdiDelete} title="Delete Vertex" />
                    </Button>
                </div>

                <div className="line-break"></div>

                <div className="toggle-row">
                    <div className="label">Edit Zone:</div>
                    <JaiaToggle
                        checked={() =>
                            jaiaContext.jaiaGlobal.getZoneInEditMode() === selectedVertex.zoneID
                        }
                        onClick={() => handleEditZoneClick()}
                    />
                </div>

                <div className="line-break"></div>
                <div className="toggle-row">
                    <div className="label">Tap to Move:</div>
                    <JaiaToggle
                        checked={() => jaiaContext.jaiaGlobal.getSelectedZoneVertex().isMoveable}
                        disabled={() => isTapToMoveDisabled()}
                        onClick={() => handleTapToMoveClick()}
                    />
                </div>

                <div className="line-break"></div>

                <div className="label">Lat:</div>
                <input
                    name={CoordinateTypes.LAT}
                    value={getLatInput()}
                    className="jaia-input coordinate"
                    autoComplete="off"
                    disabled={isDisabled}
                    onChange={(evt) => handleCoordinateChange(evt)}
                />

                <div className="label">Lon:</div>
                <input
                    name={CoordinateTypes.LON}
                    value={getLonInput()}
                    className="jaia-input coordinate"
                    autoComplete="off"
                    disabled={isDisabled}
                    onChange={(evt) => handleCoordinateChange(evt)}
                />
            </div>
            <div className="button-row">
                <button onClick={() => handleClosePanelClick(PanelActions.CANCEL)}>Cancel</button>
                <button onClick={() => handleClosePanelClick(PanelActions.DONE)}>Done</button>
            </div>
        </div>
    );
}

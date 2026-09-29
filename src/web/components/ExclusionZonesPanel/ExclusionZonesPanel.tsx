import { useContext } from "react";

import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiVectorPolygon, mdiTrashCan } from "@mdi/js";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { MDI_BUTTON_SIZE } from "../../utils/constants";
import ZonesList from "./ZonesList/ZonesList";
import ZoneStorageButton from "./ZoneStorage/ZoneStorageButton";

import "./ExclusionZonesPanel.less";

export default function ExclusionZonesPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const isDrawing = exclusionZoneLayer.isDrawActive();
    const zoneCount = jaiaContext!.exclusionZoneSet?.getZones().size ?? 0;
    const zoneSetName = jaiaContext!.exclusionZoneSet?.getName() ?? "";

    const handleDrawClick = () => jaiaDispatch({ type: JaiaActions.TOGGLE_EXCLUSION_ZONE_DRAWING });
    const handleClearClick = () => jaiaDispatch({ type: JaiaActions.CLEAR_EXCLUSION_ZONES });
    const handleNameChange = (name: string) =>
        jaiaDispatch({
            type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
            exclusionZoneSetName: name,
        });

    return (
        <div className="jaia-panel exclusion-zones-panel">
            <div className="jaia-panel-title">Exclusion Zones</div>
            <div className="jaia-button-row">
                <Button
                    className={"jaia-button" + (isDrawing ? " selected" : "")}
                    aria-label="draw-exclusion-zone"
                    onClick={handleDrawClick}
                >
                    <Icon
                        path={mdiVectorPolygon}
                        size={MDI_BUTTON_SIZE}
                        title="Draw exclusion zone"
                    />
                </Button>
                <Button
                    className="jaia-button"
                    aria-label="clear-exclusion-zones"
                    onClick={handleClearClick}
                    disabled={zoneCount === 0}
                >
                    <Icon
                        path={mdiTrashCan}
                        size={MDI_BUTTON_SIZE}
                        title="Clear all exclusion zones"
                    />
                </Button>
                <ZoneStorageButton zoneSetName={zoneSetName} />
            </div>
            {zoneCount > 0 && (
                <input
                    className="set-name"
                    placeholder="Zone Set Name"
                    value={zoneSetName}
                    onChange={(e) => handleNameChange(e.target.value)}
                />
            )}
            <ZonesList />
        </div>
    );
}

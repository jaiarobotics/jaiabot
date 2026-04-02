import { useContext } from "react";

import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiVectorPolygon, mdiTrashCan } from "@mdi/js";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { MapModes } from "../../types/openlayers-types";
import { MDI_BUTTON_SIZE } from "../../utils/constants";
import ZonesList from "./ZonesList/ZonesList";
import ZoneStorageButton from "./ZoneStorage/ZoneStorageButton";

import "./ObstacleZonesPanel.less";

export default function ObstacleZonesPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const isDrawing = jaiaGlobal.getMapMode() === MapModes.EXCLUSION_ZONE_DRAWING;
    const zoneCount = jaiaContext?.exclusionZoneSet?.getZones().size ?? 0;

    return (
        <div className="jaia-panel obstacle-zones-panel">
            <div className="jaia-panel-title">Obstacle Zones</div>
            <div className="jaia-button-row">
                <Button
                    className={"jaia-button" + (isDrawing ? " jaia-button-active" : "")}
                    aria-label="draw-obstacle-zone"
                    onClick={() =>
                        jaiaDispatch({ type: JaiaActions.TOGGLE_EXCLUSION_ZONE_DRAWING })
                    }
                >
                    <Icon
                        path={mdiVectorPolygon}
                        size={MDI_BUTTON_SIZE}
                        title="Draw obstacle zone"
                    />
                </Button>
                <Button
                    className="jaia-button"
                    aria-label="clear-obstacle-zones"
                    onClick={() => jaiaDispatch({ type: JaiaActions.CLEAR_EXCLUSION_ZONES })}
                    disabled={zoneCount === 0}
                >
                    <Icon
                        path={mdiTrashCan}
                        size={MDI_BUTTON_SIZE}
                        title="Clear all obstacle zones"
                    />
                </Button>
                <ZoneStorageButton />
            </div>
            {zoneCount > 0 && (
                <div className="zone-count">
                    {zoneCount} zone{zoneCount !== 1 ? "s" : ""} defined
                </div>
            )}
            <ZonesList />
        </div>
    );
}

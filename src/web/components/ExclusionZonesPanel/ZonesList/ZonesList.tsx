import { useContext } from "react";

import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiTrashCan } from "@mdi/js";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import JaiaToggle from "../../JaiaToggle/JaiaToggle";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";

import "./ZonesList.less";

export default function ZonesList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const zones = jaiaContext.obstacleAvoidanceData.getExclusionZoneSet().getZones();
    if (zones.size === 0) return null;

    const editZoneID = jaiaContext.jaiaGlobal.getZoneInEditMode();

    return (
        <div id="zones-list">
            {Array.from(zones.entries()).map(([zoneID, zone], idx) => {
                const isEditing = editZoneID === zoneID;
                const vertexCount = zone.vertices?.length ?? 0;
                const zoneLabel = zone.label ?? `Zone ${idx + 1}`;

                return (
                    <div className="zone-row" key={zoneID}>
                        <div className="zone-row-info">
                            <span className="zone-label">{zoneLabel}</span>
                            <span className="zone-vertex-count">{vertexCount} vertices</span>
                        </div>

                        <div className="zone-row-controls">
                            <JaiaToggle
                                checked={() => isEditing}
                                onClick={() =>
                                    jaiaDispatch({
                                        type: JaiaActions.TOGGLE_ZONE_EDIT_MODE,
                                        zoneID,
                                    })
                                }
                                label="Edit"
                                title="Toggle zone edit mode"
                            />
                            <Button
                                className="jaia-button"
                                aria-label={`delete-zone-${zoneID}`}
                                onClick={() =>
                                    jaiaDispatch({
                                        type: JaiaActions.DELETE_EXCLUSION_ZONE,
                                        zoneID,
                                    })
                                }
                            >
                                <Icon
                                    path={mdiTrashCan}
                                    size={MDI_BUTTON_SIZE}
                                    title="Delete zone"
                                />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

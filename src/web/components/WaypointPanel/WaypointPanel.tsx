import { useContext, useEffect } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { missionsManager } from "../../data/missions_manager/missions-manager";

import "./WaypointPanel.less";
import { UNASSIGNED_ID, LAT_LON_DECIMALS } from "../../utils/constants";

export default function WaypointPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatchContext = useContext(JaiaDispatchContext);

    useEffect(() => {
        return () => {
            jaiaDispatchContext({ type: JaiaActions.CLOSED_WAYPOINT_PANEL });
        };
    }, []);

    const getWaypoint = () => {
        const mission = jaiaContext.missions.get(jaiaContext.selectedWaypoint.missionID);
        return mission.getWaypoint(jaiaContext.selectedWaypoint.waypointNum);
    };

    const formatBotID = () => {
        const botID = missionsManager.getBotID(jaiaContext.selectedWaypoint.missionID);

        if (botID === UNASSIGNED_ID) {
            return "";
        }

        return botID;
    };

    return (
        <div className="waypoint-panel-container">
            <div className="waypoint-panel">
                <div className="label">Wpt:</div>
                <div>{jaiaContext.selectedWaypoint.waypointNum}</div>

                <div className="line-break"></div>

                <div className="label">Bot:</div>
                <div>{formatBotID()}</div>

                <div className="line-break"></div>

                <div className="label">Lat:</div>
                <div>{getWaypoint().getLocation().lat.toFixed(LAT_LON_DECIMALS)}</div>

                <div className="label">Lon:</div>
                <div>{getWaypoint().getLocation().lon.toFixed(LAT_LON_DECIMALS)}</div>
            </div>
        </div>
    );
}

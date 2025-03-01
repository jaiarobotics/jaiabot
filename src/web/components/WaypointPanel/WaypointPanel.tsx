import { useContext, useEffect } from "react";

import { JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";

import "./WaypointPanel.less";

export default function WaypointPanel() {
    const jaiaDispatchContext = useContext(JaiaDispatchContext);

    useEffect(() => {
        return () => {
            jaiaDispatchContext({ type: JaiaActions.CLOSED_WAYPOINT_PANEL });
        };
    }, []);

    return <div className="waypoint-panel"></div>;
}

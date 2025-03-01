import { useContext } from "react";
import { JaiaContext } from "../../context/Jaia/JaiaContext";
import { PanelNames } from "../../types/context-types";

import "./WaypointPanel.less";

export default function WaypointPanel() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    return <div className="waypoint-panel"></div>;
}

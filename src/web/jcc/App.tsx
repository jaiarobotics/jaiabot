import { useContext } from "react";

// Jaia
import { JaiaContext, JaiaContextProvider } from "../context/Jaia/JaiaContext";
import { PanelNames } from "../types/context-types";
import { NodeTypes } from "../types/jaia-system-types";

import Map from "../components/Map/Map";
import NodeList from "../containers/NodeList/NodeList";
import TopButtonList from "../components/TopButtonList/TopButtonList";
import SideButtonList from "../components/SideButtonList/SideButtonList";
import HubDetails from "../containers/HubDetails/HubDetails";
import BotDetails from "../containers/BotDetails/BotDetails";
import MissionsPanel from "../containers/MissionsPanel/MissionsPanel";
import WaypointPanel from "../components/WaypointPanel/WaypointPanel";

// Style
import "./App.less";

/**
 * The root of the JCC interface
 */
export default function App() {
    return (
        <div id="jcc">
            <JaiaContextProvider>
                <Map />
                <NodeList />
                <TopButtonList />
                <SideButtonList />
                <Details />
                <Panel />
            </JaiaContextProvider>
        </div>
    );
}

function Details() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    switch (jaiaContext.visibleDetails) {
        case NodeTypes.HUB:
            return <HubDetails />;
        case NodeTypes.BOT:
            return <BotDetails />;
        default:
            return <div></div>;
    }
}

function Panel() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    switch (jaiaContext.visiblePanel) {
        case PanelNames.MISSIONS:
            return <MissionsPanel />;
        case PanelNames.WAYPOINT:
            return <WaypointPanel />;
        default:
            return <div></div>;
    }
}

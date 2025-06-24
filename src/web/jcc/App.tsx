import { useContext } from "react";

// Jaia
import { JaiaContext, JaiaContextProvider } from "../context/JaiaContext";
import { ButtonNames } from "../types/context-types";
import { ButtonListTypes, NodeTypes } from "../types/jaia-system-types";

import Map from "../components/Map/Map";
import NodeList from "../containers/NodeList/NodeList";
import JaiaAbout from "../components/JaiaAbout/JaiaAbout";
import HubDetails from "../containers/HubDetails/HubDetails";
import BotDetails from "../containers/BotDetails/BotDetails";
import ButtonList from "../components/ButtonList/ButtonList";
import HelpWindow from "../components/HelpWindow/HelpWindow";
import RallyPanel from "../components/RallyPanel/RallyPanel";
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
                <ButtonList buttonListType={ButtonListTypes.TOP} />
                <ButtonList buttonListType={ButtonListTypes.SIDE} />
                <Details />
                <Panel />
            </JaiaContextProvider>
        </div>
    );
}

/**
 * Controls the rendering of HubDetails and BotDetails
 */
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

/**
 *  Controls the rendering of JCC panels
 */
function Panel() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    switch (jaiaContext.visiblePanel) {
        case ButtonNames.MISSIONS_PANEL:
            return <MissionsPanel />;
        case ButtonNames.WAYPOINT_PANEL:
            return <WaypointPanel />;
        case ButtonNames.HELP_PANEL:
            return <HelpWindow />;
        case ButtonNames.JAIA_ABOUT_PANEL:
            return <JaiaAbout />;
        case ButtonNames.RALLY_PANEL:
            return <RallyPanel />;
        default:
            return <div></div>;
    }
}

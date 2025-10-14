import { useContext } from "react";
import { JaiaContext, JaiaContextProvider } from "../context/JaiaContext";

import { gridPlan } from "../data/survey_planner/grid-plan";
import { ButtonNames } from "../types/context-types";
import { BotModes, ButtonListTypes, NodeTypes } from "../types/jaia-system-types";

import Map from "../components/Map/Map";
import NodeList from "../containers/NodeList/NodeList";
import JaiaAbout from "../components/JaiaAbout/JaiaAbout";
import HubDetails from "../containers/HubDetails/HubDetails";
import BotDetails from "../containers/BotDetails/BotDetails";
import ButtonList from "../components/ButtonList/ButtonList";
import HelpWindow from "../components/HelpWindow/HelpWindow";
import RallyPanel from "../components/RallyPanel/RallyPanel";
import MeasurePanel from "../components/MeasurePanel/MeasurePanel";
import MissionsPanel from "../containers/MissionsPanel/MissionsPanel";
import SettingsPanel from "../components/SettingsPanel/SettingsPanel";
import WaypointPanel from "../components/WaypointPanel/WaypointPanel";
import SurveyPlanner from "../components/SurveyPlanner/SurveyPlanner";
import TaskPacketPanel from "../components/TaskPacketPanel/TaskPacketPanel";
import DataOffloadPanel from "../components/DataOffloadPanel/DataOffloadPanel";
import RemoteControlPanel from "../components/RemoteControlPanel/RemoteControlPanel";

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
                <RemoteControl />
            </JaiaContextProvider>
            <div id="connection-warning">Connection to Hub Dropped</div>
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
        case ButtonNames.TASK_PACKET_PANEL:
            return (
                <TaskPacketPanel
                    selectedTaskPacket={jaiaContext.selectedTaskPacket}
                    taskPackets={jaiaContext.taskPackets}
                />
            );
        case ButtonNames.DATA_OFFLOAD_PANEL:
            return <DataOffloadPanel />;
        case ButtonNames.SETTINGS_PANEL:
            return <SettingsPanel />;
        case ButtonNames.MEASURE_TOOL:
            return <MeasurePanel />;
        case ButtonNames.SURVEY_TOOL:
            return <SurveyPlanner gridPlanDetails={gridPlan.getGridPlanDetails()} />;
        default:
            return <div></div>;
    }
}

/**
 * Controls the rendering of the RemoteControlPanel
 */
function RemoteControl() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return <div></div>;
    }
    if (jaiaContext.selectedNode.type === NodeTypes.BOT) {
        const selectedBot = jaiaContext.bots.get(jaiaContext.selectedNode.id);
        if (selectedBot.getMode() === BotModes.REMOTE_CONTROL) {
            return <RemoteControlPanel botID={selectedBot.getBotID()} />;
        }
    }
}

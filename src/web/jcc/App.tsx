import { useContext } from "react";
import { JaiaContext, JaiaContextProvider } from "../context/JaiaContext";

import { gridPlan } from "../data/survey_planner/grid-plan";
import { ButtonNames } from "../types/context-types";
import { BotModes, ButtonListTypes, NodeTypes } from "../types/jaia-system-types";
import { isControllingClient } from "../utils/commands";

import Map from "../components/Map/Map";
import NodeList from "../components/NodeList/NodeList";
import JaiaAbout from "../components/JaiaAbout/JaiaAbout";
import HubDetails from "../components/HubDetails/HubDetails";
import BotDetails from "../components/BotDetails/BotDetails";
import ButtonList from "../components/ButtonList/ButtonList";
import HelpWindow from "../components/HelpWindow/HelpWindow";
import RallyPanel from "../components/RallyPanel/RallyPanel";
import DepthMap3D from "../components/DepthMap3D/DepthMap3D";
import MeasurePanel from "../components/MeasurePanel/MeasurePanel";
import MissionsPanel from "../components/MissionsPanel/MissionsPanel";
import SettingsPanel from "../components/SettingsPanel/SettingsPanel";
import WaypointPanel from "../components/WaypointPanel/WaypointPanel";
import SurveyPlanner from "../components/SurveyPlanner/SurveyPlanner";
import TaskPacketPanel from "../components/TaskPacketPanel/TaskPacketPanel";
import DataOffloadPanel from "../components/DataOffloadPanel/DataOffloadPanel";
import SimulationBanner from "../components/SimulationBanner/SimulationBanner";
import TakeControlButton from "../components/__buttons__/TakeControl/TakeControlButton/TakeControlButton";
import RemoteControlPanel from "../components/RemoteControlPanel/RemoteControlPanel";

import "./App.less";

/**
 * The root of the JCC interface
 */
export default function App() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    /**
     * Places the JCC in full-screen mode on mobile devices
     *
     * @returns {void}
     */
    const handleJCCClick = () => {
        if (!document.fullscreenElement && isMobile) {
            document.documentElement.requestFullscreen();
        }
    };

    return (
        <div id="jcc" onClick={() => handleJCCClick()}>
            <JaiaContextProvider>
                <Map />
                <NodeList />
                <ButtonList buttonListType={ButtonListTypes.TOP} />
                <ButtonList buttonListType={ButtonListTypes.SIDE} />
                <Details />
                <Panel />
                <RemoteControl />
                <SimulationBanner />
                <TakeControl />
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
            return;
    }
}

/**
 *  Controls the rendering of JCC panels
 */
function Panel() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return;
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
                    selectedTaskPacket={jaiaContext.jaiaGlobal.getSelectedTaskPacket()}
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
        case ButtonNames.DEPTH_MAP_3D:
            return <DepthMap3D />;
        default:
            return;
    }
}

/**
 * Controls the rendering of the RemoteControlPanel
 */
function RemoteControl() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return;
    }
    if (jaiaContext.jaiaGlobal.getSelectedNode().type === NodeTypes.BOT) {
        const selectedBot = jaiaContext.bots.getBot(jaiaContext.jaiaGlobal.getSelectedNode().id);
        if (selectedBot.getMode() === BotModes.REMOTE_CONTROL) {
            return <RemoteControlPanel botID={selectedBot.getBotID()} />;
        }
    }
}

/**
 * Controls the rendering of the TakeControlButton
 */
function TakeControl() {
    // Use context to participate in re-render cycles
    const jaiaContext = useContext(JaiaContext);

    if (!isControllingClient()) {
        return <TakeControlButton />;
    }
}

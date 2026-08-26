import { useContext, useEffect } from "react";
import { JaiaContext, JaiaContextProvider } from "../context/JaiaContext";

import { gridPlan } from "../data/survey_planner/grid-plan";
import { ButtonNames } from "../types/context-types";
import { MissionState } from "../types/protobuf-types";
import { BotModes, ButtonListTypes, NodeTypes } from "../types/jaia-system-types";
import { isControllingClient } from "../utils/commands";
import { JCC_CONTAINER } from "../utils/constants";

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
import ExclusionZonesPanel from "../components/ExclusionZonesPanel/ExclusionZonesPanel";
import MissionRerouteDialog from "../components/MissionRerouteDialog/MissionRerouteDialog";
import WaypointRemovalDialog from "../components/WaypointRemovalDialog/WaypointRemovalDialog";

import PlacementErrorDialog from "../components/PlacementErrorDialog/PlacementErrorDialog";
import SettingsPanel from "../components/SettingsPanel/SettingsPanel";
import WaypointPanel from "../components/WaypointPanel/WaypointPanel";
import ZoneVertexPanel from "../components/ZoneVertexPanel/ZoneVertexPanel";
import SurveyPlanner from "../components/SurveyPlanner/SurveyPlanner";
import NotificationDot from "../components/NotificationDot/NotificationDot";
import TaskPacketPanel from "../components/TaskPacketPanel/TaskPacketPanel";
import DataOffloadPanel from "../components/DataOffloadPanel/DataOffloadPanel";
import SimulationBanner from "../components/SimulationBanner/SimulationBanner";
import TakeControlButton from "../components/__buttons__/TakeControl/TakeControlButton/TakeControlButton";
import RemoteControlPanel from "../components/RemoteControlPanel/RemoteControlPanel";
import LoadingPanel from "../components/RemoteControlPanel/LoadingPanel/LoadingPanel";

import "./App.less";

// 400 ms is intentionally conservative to avoid flicker or partially rendered content on slower devices.
const LOADING_SCREEN_REMOVAL_DELAY_MS = 400;
const RC_STATE = MissionState.IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT;

/**
 * The root of the JCC interface
 */
export default function App() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    useEffect(() => {
        // Remove the initial HTML loading screen when React mounts and is ready
        const initialLoadingScreen = document.getElementById("initial-loading-screen");
        if (initialLoadingScreen) {
            setTimeout(() => initialLoadingScreen.remove(), LOADING_SCREEN_REMOVAL_DELAY_MS);
        }
    }, []);

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
        <div id={JCC_CONTAINER} onClick={() => handleJCCClick()}>
            <JaiaContextProvider>
                <Map />
                <NodeList />
                <ButtonList buttonListType={ButtonListTypes.TOP} />
                <ButtonList buttonListType={ButtonListTypes.SIDE} />
                <Details />
                <Panel />
                <RemoteControl />
                <SimulationBanner />
                <NotificationDot className="jaia-about-button" />
                <TakeControl />
                <MissionRerouteDialog />
                <WaypointRemovalDialog />
                <PlacementErrorDialog />
            </JaiaContextProvider>
            <div id="connection-warning">Connection to Hub Dropped</div>
            <div id="congestion-warning">Slow Hub WiFi Speeds</div>
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
        case ButtonNames.EXCLUSION_ZONES_PANEL:
            return <ExclusionZonesPanel />;
        case ButtonNames.WAYPOINT_PANEL:
            return <WaypointPanel />;
        case ButtonNames.ZONE_VERTEX_PANEL:
            return <ZoneVertexPanel />;
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

        if (
            selectedBot.getMode() === BotModes.REMOTE_CONTROL &&
            selectedBot.getMissionStatus().missionState === RC_STATE
        ) {
            return <RemoteControlPanel botID={selectedBot.getBotID()} />;
        }

        if (selectedBot.getMode() === BotModes.REMOTE_CONTROL) {
            return <LoadingPanel />;
        }
    }
}

/**
 * Controls the rendering of the TakeControlButton
 */
function TakeControl() {
    // Use context to participate in re-render cycles
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return;
    }

    if (!isControllingClient()) {
        return <TakeControlButton />;
    }
}

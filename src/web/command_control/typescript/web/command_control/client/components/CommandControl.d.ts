/// <reference types="node" />
import React, { ReactElement, ReactNode } from 'react';
import { HubOrBot } from './HubOrBot';
import { BotLayers } from './BotLayers';
import { HubLayers } from './HubLayers';
import { CommandList } from './Missions';
import { SurveyLines } from './SurveyLines';
import { Interactions } from './Interactions';
import { SurveyExclusions } from './SurveyExclusions';
import { MissionParams } from './MissionSettings';
import { PodStatus, PortalBotStatus, Metadata } from './shared/PortalStatus';
import { DetailsExpandedState } from './Details';
import { Goal, GeographicCoordinate, Command, Engineering, MissionTask, TaskPacket, BottomDepthSafetyParams } from './shared/JAIAProtobuf';
import OlFeature from 'ol/Feature';
import OlCollection from 'ol/Collection';
import { Interaction } from 'ol/interaction';
import { Feature, MapBrowserEvent } from 'ol';
import { Geometry, Point } from 'ol/geom';
import * as turf from '@turf/turf';
import 'reset-css';
import '../style/CommandControl.less';
interface Props {
}
export declare enum PanelType {
    NONE = "NONE",
    MISSION = "MISSION",
    ENGINEERING = "ENGINEERING",
    MISSION_SETTINGS = "MISSION_SETTINGS",
    MEASURE_TOOL = "MEASURE_TOOL",
    RUN_INFO = "RUN_INFO",
    GOAL_SETTINGS = "GOAL_SETTINGS",
    DOWNLOAD_PANEL = "DOWNLOAD_PANEL",
    RALLY_POINT = "RALLY_POINT",
    TASK_PACKET = "TASK_PACKET",
    SETTINGS = "SETTINGS"
}
export declare enum Mode {
    NONE = "",
    MISSION_PLANNING = "missionPlanning",
    NEW_RALLY_POINT = "newRallyPoint"
}
export interface RunInterface {
    id: string;
    name: string;
    assigned: number;
    command: Command;
    showTableOfWaypoints: boolean;
}
export interface MissionInterface {
    id: string;
    name: string;
    runs: {
        [key: string]: RunInterface;
    };
    runIdIncrement: number;
    botsAssignedToRuns: {
        [key: number]: string;
    };
    runIdInEditMode: string;
}
interface State {
    podStatus: PodStatus;
    podStatusVersion: number;
    botExtents: {
        [key: number]: number[];
    };
    lastBotCount: number;
    missionParams: MissionParams;
    missionPlanningGrid?: {
        [key: string]: number[][];
    };
    missionPlanningLines?: any;
    missionPlanningFeature?: OlFeature<Geometry>;
    missionBaseGoal: Goal;
    missionStartTask: MissionTask;
    missionEndTask: MissionTask;
    runList: MissionInterface;
    runListVersion: number;
    flagClickedInfo: {
        runNum: number;
        botId: number;
    };
    goalBeingEdited: {
        goal?: Goal;
        originalGoal?: Goal;
        goalIndex?: number;
        botId?: number;
        runNumber?: number;
        moveWptMode?: boolean;
    };
    selectedFeatures?: OlCollection<OlFeature>;
    selectedHubOrBot?: HubOrBot;
    measureFeature?: OlFeature;
    rallyCounter: number;
    reusableRallyNums: number[];
    selectedRallyFeature: OlFeature<Point>;
    startRally: OlFeature<Point>;
    endRally: OlFeature<Point>;
    mode: Mode;
    currentInteraction: Interaction | null;
    trackingTarget: number | string;
    homeLocation?: GeographicCoordinate;
    visiblePanel: PanelType;
    detailsBoxItem?: HubOrBot;
    detailsExpanded: DetailsExpandedState;
    botDownloadQueue: PortalBotStatus[];
    loadMissionPanel?: ReactElement;
    saveMissionPanel?: ReactElement;
    surveyExclusionCoords?: number[][];
    centerLineString: turf.helpers.Feature<turf.helpers.LineString>;
    bottomDepthSafetyParams: BottomDepthSafetyParams;
    isSRPEnabled: boolean;
    rcModeStatus: {
        [botId: number]: boolean;
    };
    remoteControlValues: Engineering;
    remoteControlInterval?: ReturnType<typeof setInterval>;
    rcDives: {
        [botId: number]: {
            [taskParams: string]: string;
        };
    };
    taskPacketType: string;
    taskPacketData: {
        [key: string]: {
            [key: string]: string;
        };
    };
    selectedTaskPacketFeature: OlFeature;
    taskPacketIntervalId: NodeJS.Timeout;
    taskPacketsTimeline: {
        [key: string]: string | boolean;
    };
    isClusterModeOn: boolean;
    isHelpWindowDisplayed: boolean;
    disconnectionMessage?: string;
    viewportPadding: number[];
    metadata: Metadata;
    customAlert?: ReactNode;
}
interface BotAllCommandInfo {
    botIds?: number[];
    botIdsInIdleState?: number[];
    botIdsNotInIdleState?: number[];
    botIdsInStoppedState?: number[];
    botIdsPoorHealth?: number[];
    botIdsDisconnected?: number[];
    botIdsDownloadNotAvailable?: number[];
    botIdsInDownloadQueue?: number[];
    botIdsWifiDisconnected?: number[];
    idleStateMessage?: string;
    notIdleStateMessage?: string;
    stoppedStateMessage?: string;
    poorHealthMessage?: string;
    downloadQueueMessage?: string;
    disconnectedMessage?: string;
}
export default class CommandControl extends React.Component {
    props: Props;
    state: State;
    api: import("../../common/JaiaAPI").JaiaAPI;
    mapDivId: string;
    botLayers: BotLayers;
    hubLayers: HubLayers;
    oldPodStatus?: PodStatus;
    missionPlans?: CommandList;
    taskPackets: TaskPacket[];
    taskPacketsCount: number;
    enabledEditStates: string[];
    enabledDownloadStates: string[];
    interactions: Interactions;
    surveyLines: SurveyLines;
    surveyExclusions: SurveyExclusions;
    podStatusPollId: NodeJS.Timeout;
    metadataPollId: NodeJS.Timeout;
    flagNumber: number;
    missionHistory: MissionInterface[];
    constructor(props: Props);
    static formatLength(line: Geometry): string;
    componentDidMount(): void;
    componentDidUpdate(prevProps: Props, prevState: State, snapshot: any): void;
    componentWillUnmount(): void;
    keyPressed(e: KeyboardEvent): void;
    setupMapLayersPanel(): void;
    getPodExtent(): number[];
    getBotExtent(bot_id: number): number[];
    setViewport(dims: number[]): void;
    zoomToPod(firstMove?: boolean): void;
    zoomToBot(id: number, firstMove?: boolean): void;
    centerOn(coords: number[], stopTracking?: boolean, firstMove?: boolean): void;
    fit(geom: number[], opts: any, stopTracking?: boolean, firstMove?: boolean): void;
    changeInteraction(newInteraction?: Interaction, cursor?: string): void;
    defaultInteraction(): void;
    stopDown(arg: boolean): boolean;
    changeMissionMode(): void;
    clearMissionPlanningState(): void;
    pollMetadata(): void;
    pollPodStatus(): void;
    pollTaskPackets(): void;
    hubConnectionError(errMsg: String): void;
    getPodStatus(): PodStatus;
    setPodStatus(podStatus: PodStatus): void;
    getMetadata(): Metadata;
    getBotStatusAge(botId: number): number;
    toggleBot(bot_id?: number): void;
    toggleHub(id: number): void;
    didClickBot(bot_id: number): void;
    didClickHub(hub_id: number): void;
    selectBot(id: number): void;
    selectHub(id: number): void;
    selectedBotId(): number;
    selectedHubId(): number;
    unselectHubOrBot(): void;
    isBotSelected(bot_id: number): boolean;
    isHubSelected(hub_id: number): boolean;
    getFleetId(): number;
    getBotIdList(): number[];
    trackBot(id: number | string): void;
    doTracking(): void;
    weAreInControl(): boolean;
    takeControl(onSuccess: () => void): void;
    getRunList(): MissionInterface;
    setRunList(runList: MissionInterface): void;
    updateMissionHistory(mission: MissionInterface): void;
    detectTaskChange(): void;
    areBotsAssignedToRuns(): boolean;
    areThereRuns(): boolean;
    getActiveRunNumbers(mission: MissionInterface): number[];
    getRun(botId: number): RunInterface;
    toggleShowTableOfWaypoints: (runId: string) => void;
    _runMission(botMission: Command): void;
    runMissions(mission: MissionInterface, addRuns: CommandList): void;
    deleteAllRunsInMission(mission: MissionInterface, needConfirmation: boolean, rallyPointMission?: boolean): Promise<unknown>;
    deleteSingleRun(runId: string, disableMessage?: string): void;
    generateDeleteAllRunsWarnStr(rallyPointRun?: boolean): "Proceeding with this action will move all bots towards the selected rally point, deleting their current missions." | "Are you sure you want to delete all runs in this mission?";
    loadMissions(missionToLoad: MissionInterface): void;
    loadMissionButtonClicked(): void;
    saveMissionButtonClicked(): void;
    getMissionFeatures(missions: MissionInterface, podStatus?: PodStatus, selectedBotId?: number): OlFeature<Geometry>[];
    getWaypointFeatures(missions: MissionInterface, podStatus?: PodStatus, selectedBotId?: number): OlFeature<Geometry>[];
    updateMissionLayer(): void;
    updateHubCommsCircles(): void;
    updateActiveMissionLayer(): void;
    updateBotCourseOverGroundLayer(): void;
    updateBotHeadingLayer(): void;
    updateMissionPlanningLayer(): void;
    addWaypointAtCoordinate(coordinate: number[]): void;
    addWaypointAt(location: GeographicCoordinate): void;
    handleEvent(evt: any): boolean;
    clickEvent(evt: MapBrowserEvent<UIEvent>): boolean;
    toggleEditMode(evt: React.ChangeEvent<HTMLInputElement>, run: RunInterface): void;
    setMoveWptMode(canMoveWpt: boolean, runId: string, goalNum: number): void;
    clickToMoveWaypoint(evt: MapBrowserEvent<UIEvent>): boolean;
    addRallyPointAt(coordinate: number[]): void;
    getRallyNumber(): number;
    goToRallyPoint(rallyFeature: OlFeature<Point>): void;
    deleteRallyPoint(rallyFeature: OlFeature): void;
    assignRallyPointsAfterDelete(rallyFeature: OlFeature): void;
    setSelectedRallyPoint(rallyPoint: OlFeature<Geometry>, isStart: boolean): void;
    handleJccContainerClick(): void;
    updateTaskPacketLayer(): void;
    unselectTaskPacket(type: string): void;
    unselectAllTaskPackets(): void;
    setTaskPacketInterval(selectedFeature: Feature, type: string): void;
    setClusterModeStatus(isOn: boolean): void;
    handleTaskPacketEditDatesToggle(): void;
    handleTaskPacketsTimelineChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmitTaskPacketsTimeline(): void;
    handleKeepEndDateCurrentToggle(): void;
    isTaskPacketsSendBtnDisabled(): boolean;
    resetTaskPacketsTimeline(isEditing: boolean): void;
    getTaskPackets(): TaskPacket[];
    setTaskPackets(taskPackets: TaskPacket[]): void;
    getTaskPacketsCount(): number;
    setTaskPacketsCount(count: number): void;
    setTaskPacketDates(forceDateChange?: {
        [type: string]: boolean;
    }): {
        [x: string]: string | boolean;
    };
    isRCModeActive(botId: number): boolean;
    setRcMode(botId: number, rcMode: boolean): void;
    createRemoteControlInterval(): void;
    clearRemoteControlInterval(): void;
    weHaveRemoteControlInterval(): boolean;
    runRCMode(): void;
    initRCDivesParams(botId: number): void;
    setRCDiveParams(diveParams: {
        [param: string]: string;
    }): void;
    processDownloadAllBots(): Promise<void>;
    processDownloadSingleBot(bot: PortalBotStatus, disableMessage: string): Promise<void>;
    downloadBotsInOrder(): Promise<void>;
    downloadBot(bot: PortalBotStatus, retryDownload: boolean): Promise<void>;
    startDownload(bot: PortalBotStatus, retryDownload: boolean): Promise<void>;
    waitForPostDepoloymentIdle(bot: PortalBotStatus, retryDownload?: boolean): Promise<void>;
    removeBotFromQueue(bot: PortalBotStatus): void;
    getDownloadableBots(): PortalBotStatus[];
    getBotMissionState(botId: number): import("./shared/JAIAProtobuf").MissionState;
    getBotDownloadPercent(botId: number): number;
    isBotInQueue(bot: PortalBotStatus): boolean;
    commandDrawer(): React.JSX.Element;
    determineAllCommandBots(sendingMission: boolean, sendingActivate: boolean, sendingStop: boolean, sendingDownload: boolean): BotAllCommandInfo;
    activateAllClicked(): void;
    rallyButtonClicked(): void;
    sendStopAll(): void;
    playClicked(evt: UIEvent): void;
    recoverAllClicked(): void;
    handleUndoClick(): void;
    sendFlag(evt: UIEvent): void;
    autoAssignBotsToRuns(): void;
    setMissionParams(params: MissionParams): void;
    setBottomDepthSafetyParams(params: BottomDepthSafetyParams): void;
    addSRPInputsToRuns(): void;
    deleteSRPInputsFromRuns(): void;
    getValidSRPInputs(): {
        constant_heading: string;
        constant_heading_time: string;
        constant_heading_speed: string;
        safety_depth: string;
    };
    checkSRPInputs(value: string, max: number, removeDecimal?: boolean): string;
    canUseSurveyTool(): boolean;
    setIsSRPEnabled(isSRPEnabled: boolean): void;
    setVisiblePanel(panelType: PanelType): void;
    setDetailsExpanded(accordian: keyof DetailsExpandedState, isExpanded: boolean): void;
    disconnectionPanel(): React.JSX.Element;
    takeControlPanel(): React.JSX.Element;
    render(): React.JSX.Element;
}
export {};

import React from 'react';
import Map from 'ol/Map';
import turf from '@turf/turf';
import { SelectChangeEvent } from '@mui/material/Select';
import { BotStatus, BottomDepthSafetyParams, Goal, MissionTask } from './shared/JAIAProtobuf';
import { MissionInterface } from './CommandControl';
import { Geometry } from 'ol/geom';
import { Feature } from 'ol';
import '../style/components/MissionSettings.css';
export interface MissionSettings {
    endTask: MissionTask;
}
export interface MissionParams {
    missionType: 'editing' | 'polygon-grid' | 'lines' | 'exclusions';
    numRuns: number;
    numGoals: number;
    pointSpacing: number;
    lineSpacing: number;
    orientation: number;
    spArea: number;
    spPerimeter: number;
    spRallyStartDist: number;
    spRallyFinishDist: number;
    selectedBots: number[];
    useMaxLength: boolean;
}
interface Props {
    map: Map;
    missionParams: MissionParams;
    setMissionParams: (missionParams: MissionParams) => void;
    missionPlanningGrid: {
        [key: string]: number[][];
    };
    missionPlanningFeature: Feature<Geometry>;
    missionBaseGoal: Goal;
    missionStartTask: MissionTask;
    missionEndTask: MissionTask;
    rallyFeatures: Feature<Geometry>[];
    startRally: Feature<Geometry>;
    endRally: Feature<Geometry>;
    centerLineString: turf.helpers.Feature<turf.helpers.LineString>;
    runList: MissionInterface;
    bottomDepthSafetyParams: BottomDepthSafetyParams;
    setBottomDepthSafetyParams: (params: BottomDepthSafetyParams) => void;
    isSRPEnabled: boolean;
    setIsSRPEnabled: (isSRPEnabled: boolean) => void;
    botList?: {
        [key: string]: BotStatus;
    };
    onClose: () => void;
    onMissionApply: (startRally: Feature<Geometry>, endRally: Feature<Geometry>, missionStartTask: MissionTask, missionEndTask: MissionTask) => void;
    onMissionChangeEditMode: () => void;
    onTaskTypeChange: () => void;
    setSelectedRallyPoint: (rallyPoint: Feature<Geometry>, isStart: boolean) => void;
    onChange?: () => void;
    areThereRuns: () => boolean;
}
interface State {
    missionParams: MissionParams;
    missionBaseGoal: Goal;
    missionStartTask: MissionTask;
    missionEndTask: MissionTask;
    botList?: {
        [key: string]: BotStatus;
    };
}
export declare class MissionSettingsPanel extends React.Component {
    props: Props;
    state: State;
    onClose: () => void;
    onChange?: () => void;
    onMissionChangeEditMode: () => void;
    onTaskTypeChange: () => void;
    constructor(props: Props);
    componentDidUpdate(): void;
    isMissionDrawn(): {
        [key: string]: number[][];
    };
    getSortedRallyFeatures(): Feature<Geometry>[];
    handleBottomDepthSafetyParamChange(evt: Event): void;
    handleSRPToggleClick(): void;
    render(): React.JSX.Element;
    validateNumInput(value: number): number;
    changePointSpacing(evt: Event): void;
    changeLineSpacing(evt: Event): void;
    changeRunCount(evt: Event): void;
    handleRallyFeatureSelection(evt: SelectChangeEvent, isStart: boolean): void;
    closeClicked(): void;
    applyMissionClicked(): Promise<void>;
    changeMissionBotSelection(): void;
    changeMissionEditMode(missionEditMode: string): void;
    applyMissionEditMode(): void;
}
export {};

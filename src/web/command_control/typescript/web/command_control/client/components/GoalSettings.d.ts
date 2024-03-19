import React, { ChangeEvent } from 'react';
import { Map } from 'ol';
import { Goal } from './shared/JAIAProtobuf';
import { MissionInterface, PanelType } from './CommandControl';
import '../style/components/GoalSettingsPanel.css';
declare enum LatLon {
    LAT = "lat",
    LON = "lon"
}
interface Props {
    botId: number;
    goalIndex: number;
    goal: Goal;
    originalGoal: Goal;
    map: Map;
    runList: MissionInterface;
    runNumber: number;
    onChange: () => void;
    onDoneClick: () => void;
    setVisiblePanel: (panelType: PanelType) => void;
    setMoveWptMode: (canMoveWptMode: boolean, runId: string, goalNum: number) => void;
    setRunList: (runList: MissionInterface) => void;
    updateMissionHistory: (mission: MissionInterface) => void;
}
interface State {
    isChecked: boolean;
    goalIndex: number;
    pauseNumModif: boolean;
    enterNegative: {
        [direction: string]: boolean;
    };
}
export declare class GoalSettingsPanel extends React.Component {
    props: Props;
    state: State;
    autoScrollTimeout: number;
    constructor(props: Props);
    componentWillUnmount(): void;
    handleToggleClick(): void;
    isChecked(): boolean;
    doneClicked(): void;
    cancelClicked(): void;
    updatePanelVisibility(): void;
    getCoordValue(coordType: LatLon, tempValue?: string): string | number;
    handleCoordChange(e: ChangeEvent<HTMLInputElement>, coordType: LatLon): void;
    deleteWaypoint(): Promise<void>;
    scrollTaskSettingsIntoView(): void;
    render(): React.JSX.Element;
}
export {};

import React from 'react';
import { MissionInterface, RunInterface } from '../CommandControl';
type RunPanelProps = {
    botIds: number[];
    mission: MissionInterface;
    loadMissionClick: any;
    saveMissionClick: any;
    deleteAllRunsInMission: any;
    autoAssignBotsToRuns: any;
    deleteSingleRun: (runId: string) => void;
    unSelectHubOrBot: () => void;
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean;
    setRunList: (runList: MissionInterface) => void;
    updateMissionHistory: (mission: MissionInterface) => void;
    toggleShowTableOfWaypoints: (runId: string) => void;
};
type RunPanelState = {};
export default class RunPanel extends React.Component<RunPanelProps, RunPanelState> {
    addDuplicateRun(run: RunInterface): void;
    handleBotAssignChange(prevBotId: number, newBotId: number, runId: string): void;
    getBotsNotAssignedToRuns(): number[];
    render(): React.JSX.Element;
}
export {};

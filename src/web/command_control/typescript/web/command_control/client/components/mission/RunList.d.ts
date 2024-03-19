import React from 'react';
import { RunInterface } from '../CommandControl';
type RunListProps = {
    botIds: number[];
    botsNotAssignedToRuns: number[];
    runIdInEditMode: string;
    runs: {
        [key: string]: RunInterface;
    };
    loadMissionClick: any;
    saveMissionClick: any;
    deleteAllRunsInMission: any;
    autoAssignBotsToRuns: any;
    handleBotAssignChange: (prevBotId: number, newBotId: number, runId: string) => void;
    unSelectHubOrBot: () => void;
    addDuplicateRun: (run: RunInterface) => void;
    deleteSingleRun: (runId: string) => void;
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean;
    toggleShowTableOfWaypoints: (runId: string) => void;
};
type RunListState = {
    openRunPanels: {
        [runId: string]: boolean;
    };
    runIdInEditMode: string;
};
export default class RunList extends React.Component<RunListProps, RunListState> {
    state: RunListState;
    componentDidUpdate(): void;
    initRunPanelStates(): void;
    setOpenRunPanels(openRunPanels: {
        [runId: string]: boolean;
    }): void;
    render(): React.JSX.Element;
}
export {};

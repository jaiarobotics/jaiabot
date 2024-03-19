import React from 'react';
import { JaiaAPI } from '../../../common/JaiaAPI';
import { MissionInterface, RunInterface } from '../CommandControl';
type MissionControllerProps = {
    api: JaiaAPI;
    botIds: number[];
    mission: MissionInterface;
    loadMissionClick: any;
    saveMissionClick: any;
    deleteAllRunsInMission: any;
    autoAssignBotsToRuns: any;
    deleteSingleRun: (runId: string) => void;
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean;
    unSelectHubOrBot: () => void;
    setRunList: (mission: MissionInterface) => void;
    updateMissionHistory: (mission: MissionInterface) => void;
    toggleShowTableOfWaypoints: (runId: string) => void;
};
type MissionControllerState = {};
export default class MissionControllerPanel extends React.Component<MissionControllerProps, MissionControllerState> {
    render(): React.JSX.Element;
}
export {};

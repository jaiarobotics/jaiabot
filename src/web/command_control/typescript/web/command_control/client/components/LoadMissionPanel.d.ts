import React from 'react';
import { MissionLibraryLocalStorage } from './MissionLibrary';
import { MissionInterface } from './CommandControl';
interface Props {
    missionLibrary: MissionLibraryLocalStorage;
    selectedMission: (mission: MissionInterface) => void;
    onCancel: () => void;
    areThereRuns: () => boolean;
}
interface State {
    selectedMissionName: string | null;
}
export declare class LoadMissionPanel extends React.Component {
    props: Props;
    state: State;
    constructor(props: Props);
    render(): React.JSX.Element;
    didClick(name: string): void;
    loadClicked(): void;
    deleteSelectedMission(): void;
    deleteClicked(): void;
    cancelClicked(): void;
    uploadClicked(): void;
}
export {};

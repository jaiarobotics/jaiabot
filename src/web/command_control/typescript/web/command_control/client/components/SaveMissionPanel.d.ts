import React from 'react';
import { MissionLibraryLocalStorage } from './MissionLibrary';
import { MissionInterface } from './CommandControl';
interface Props {
    missionLibrary: MissionLibraryLocalStorage;
    mission: MissionInterface;
    onDone: () => void;
}
interface State {
    selectedMissionName: string | null;
}
export declare class SaveMissionPanel extends React.Component {
    props: Props;
    state: State;
    constructor(props: Props);
    render(): React.JSX.Element;
    didClick(name: string): void;
    saveClicked(): Promise<void>;
    deleteClicked(): Promise<void>;
    cancelClicked(): void;
    downloadClicked(): void;
}
export {};

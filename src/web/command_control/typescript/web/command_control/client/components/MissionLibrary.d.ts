import { MissionInterface } from './CommandControl';
export declare class MissionLibraryLocalStorage {
    static missionLibraryLocalStorage: MissionLibraryLocalStorage;
    static shared(): MissionLibraryLocalStorage;
    constructor();
    missionNames(): string[];
    hasMission(name: string): boolean;
    loadMission(key: string): MissionInterface;
    saveMission(key: string, mission: MissionInterface): void;
    deleteMission(key: string): void;
}

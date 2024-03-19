import { Goal, GeographicCoordinate, Command } from './shared/JAIAProtobuf';
import { MissionInterface, RunInterface } from './CommandControl';
export type Run = {
    [key: string]: RunInterface;
};
export type RunLibrary = {
    [key: string]: MissionInterface;
};
export type CommandList = {
    [key: number]: Command;
};
export declare class Missions {
    static defaultMissions(): RunLibrary;
    static RCMode(botId: number, datumLocation: GeographicCoordinate): Command;
    static commandWithWaypoints(botId: number, locations: GeographicCoordinate[]): Command;
    static isValidRunNumber(mission: MissionInterface): boolean;
    static addRunWithWaypoints(botId: number, locations: GeographicCoordinate[], mission: MissionInterface, unAssignedMission?: boolean): MissionInterface;
    static addRunWithGoals(botId: number, goals: Goal[], mission: MissionInterface, setEditModeToggle?: (runNumber: number, isOn: boolean) => void): MissionInterface;
    static duplicateRun(run: RunInterface, mission: MissionInterface): void;
    static addRunWithCommand(botId: number, command: Command, mission: MissionInterface): MissionInterface;
}

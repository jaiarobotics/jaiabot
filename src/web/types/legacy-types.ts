import { Command } from "../shared/proto/jaiabot/messages/jaia_dccl";

export interface LegacyRunInterface {
    id: string;
    name: string;
    assigned: number;
    command: Command;
    showTableOfWaypoints: boolean;
}

export interface LegacyMissionInterface {
    id: string;
    name: string;
    runs: { [key: string]: LegacyRunInterface };
    runIdIncrement: number;
    botsAssignedToRuns: { [key: number]: string };
    runIdInEditMode: string;
}

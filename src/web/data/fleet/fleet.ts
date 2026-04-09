import { HealthState } from "../../types/protobuf-types";
import { CommandCommsResult } from "../../shared/PortalStatus";

export enum CommsResult {
    SUCCESS = "SUCCESS",
    FAILURE = "FAILURE",
}

const FLEET_COMMAND_GROUP_WINDOW_MS = 3_000;
const MAX_COMMAND_GROUPS = 50;

export interface CommandResultGroup {
    commandType: string;
    timestamp: number;
    results: CommandCommsResult[];
    successCount: number;
    failureCount: number;
    totalBots: number;
}

export class Fleet {
    private commandCommsResults: CommandCommsResult[] = [];

    getCommandCommsResults(): CommandCommsResult[] {
        return this.commandCommsResults;
    }

    setCommandCommsResults(results: CommandCommsResult[]) {
        this.commandCommsResults = results ?? [];
    }

    computeWorstHealthState(healthStates: HealthState[]): HealthState {
        if (healthStates.includes(HealthState.HEALTH__FAILED)) {
            return HealthState.HEALTH__FAILED;
        }
        if (healthStates.includes(HealthState.HEALTH__DEGRADED)) {
            return HealthState.HEALTH__DEGRADED;
        }
        return HealthState.HEALTH__OK;
    }

    getCommandResultGroups(): CommandResultGroup[] {
        const groups: CommandResultGroup[] = [];
        const seenKeys = new Set<string>();

        for (const result of this.commandCommsResults) {
            const commandType = result.orig_command?.type ?? "UNKNOWN";
            const botId = result.orig_command?.bot_id;
            const commandTime =
                result.orig_command?.time != null ? result.orig_command.time / 1000 : Date.now();

            const dedupKey = `${botId}_${result.orig_command?.time}`;
            if (seenKeys.has(dedupKey)) {
                continue;
            }
            seenKeys.add(dedupKey);

            const existingGroup = groups.find(
                (g) =>
                    g.commandType === commandType &&
                    Math.abs(g.timestamp - commandTime) <= FLEET_COMMAND_GROUP_WINDOW_MS &&
                    !g.results.some((r) => r.orig_command?.bot_id === botId),
            );

            if (existingGroup) {
                existingGroup.results.push(result);
                if (result.result === CommsResult.SUCCESS) {
                    existingGroup.successCount++;
                } else if (result.result === CommsResult.FAILURE) {
                    existingGroup.failureCount++;
                }
                existingGroup.totalBots = existingGroup.results.length;
            } else {
                groups.push({
                    commandType,
                    timestamp: commandTime,
                    results: [result],
                    successCount: result.result === CommsResult.SUCCESS ? 1 : 0,
                    failureCount: result.result === CommsResult.FAILURE ? 1 : 0,
                    totalBots: 1,
                });
            }
        }

        groups.sort((a, b) => b.timestamp - a.timestamp);
        return groups.slice(0, MAX_COMMAND_GROUPS);
    }
}

export const fleet = new Fleet();

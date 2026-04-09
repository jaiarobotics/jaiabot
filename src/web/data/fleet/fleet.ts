import { HealthState } from "../../types/protobuf-types";
import { CommandCommsResult, CommsResult } from "../../shared/JAIAProtobuf";

// Groups command comms results that arrived within this window (ms) with the same command type
const FLEET_COMMAND_GROUP_WINDOW_MS = 15_000;
const MAX_COMMAND_GROUPS = 50;

export interface CommandResultGroup {
    commandType: string;
    timestamp: number;
    results: CommandCommsResult[];
    successCount: number;
    failureCount: number;
    totalBots: number;
}

/**
 * Singleton that tracks fleet-wide health and command acknowledgment results.
 */
export class Fleet {
    private commandCommsResults: CommandCommsResult[] = [];

    getCommandCommsResults(): CommandCommsResult[] {
        return this.commandCommsResults;
    }

    setCommandCommsResults(results: CommandCommsResult[]) {
        this.commandCommsResults = results;
    }

    /**
     * Computes the worst health state across all provided health states.
     */
    computeWorstHealthState(healthStates: HealthState[]): HealthState {
        if (healthStates.includes(HealthState.HEALTH__FAILED)) {
            return HealthState.HEALTH__FAILED;
        }
        if (healthStates.includes(HealthState.HEALTH__DEGRADED)) {
            return HealthState.HEALTH__DEGRADED;
        }
        return HealthState.HEALTH__OK;
    }

    /**
     * Groups command comms results by command type and time proximity, returning
     * an array of summarized groups sorted newest-first.
     */
    getCommandResultGroups(): CommandResultGroup[] {
        const groups: CommandResultGroup[] = [];

        for (const result of this.commandCommsResults) {
            const commandType = result.orig_command?.type ?? "UNKNOWN";
            const botId = result.orig_command?.bot_id;
            const commandTime =
                result.orig_command?.time != null ? result.orig_command.time / 1000 : Date.now();

            // Try to add to an existing group within the time window
            const existingGroup = groups.find(
                (g) =>
                    g.commandType === commandType &&
                    Math.abs(g.timestamp - commandTime) <= FLEET_COMMAND_GROUP_WINDOW_MS,
            );

            if (existingGroup) {
                // Avoid double-counting the same bot in the same group
                const alreadyHasBot = existingGroup.results.some(
                    (r) => r.orig_command?.bot_id === botId,
                );
                if (!alreadyHasBot) {
                    existingGroup.results.push(result);
                    if (result.result === CommsResult.SUCCESS) {
                        existingGroup.successCount++;
                    } else {
                        existingGroup.failureCount++;
                    }
                    existingGroup.totalBots = existingGroup.results.length;
                }
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

        // Sort newest first, then cap
        groups.sort((a, b) => b.timestamp - a.timestamp);
        return groups.slice(0, MAX_COMMAND_GROUPS);
    }
}

export const fleet = new Fleet();

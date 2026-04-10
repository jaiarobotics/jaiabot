import { HealthState } from "../../types/protobuf-types";
import { CommandTrackingSnapshot } from "../../shared/PortalStatus";

const MAX_COMMAND_GROUPS = 50;

export interface CommandResultGroup {
    key: string;
    commandType: string;
    timestamp: number;
    successCount: number;
    failureCount: number;
    totalBots: number;
    failedBotIDs: number[];
}

export class Fleet {
    private commandTracking: CommandTrackingSnapshot = { commands: [], rollups: [] };

    setCommandTracking(commandTracking?: CommandTrackingSnapshot) {
        this.commandTracking = commandTracking ?? { commands: [], rollups: [] };
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
        const groups = this.commandTracking.rollups
            .map((rollup) => {
                const failedBotIDs = Array.isArray(rollup.failed_bot_ids)
                    ? [...rollup.failed_bot_ids].sort((a, b) => a - b)
                    : Array.from(
                          new Set(
                              this.commandTracking.commands
                                  .filter(
                                      (command) =>
                                          command.group_id === rollup.group_id &&
                                          command.ack_result === "FAILURE" &&
                                          command.bot_id != null,
                                  )
                                  .map((command) => command.bot_id),
                          ),
                      ).sort((a, b) => a - b);

                return {
                    key: rollup.group_id,
                    commandType: rollup.command_type,
                    timestamp: rollup.sent_time,
                    successCount: rollup.ack_success,
                    failureCount: rollup.ack_failure,
                    totalBots: rollup.total_targets,
                    failedBotIDs,
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        return groups.slice(0, MAX_COMMAND_GROUPS);
    }
}

export const fleet = new Fleet();

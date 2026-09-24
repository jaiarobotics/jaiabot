import { TaskPacket } from "../../types/protobuf-types";

// Grouping key for task packets that have no mission_name.
export const UNNAMED_MISSION_SET_KEY = "__UNNAMED__";

export interface MissionSetSummary {
    key: string;
    name: string | null;
    startTime: number;
    endTime: number;
    taskPacketCount: number;
    excludedTaskPacketCount: number;
}

/**
 * Returns the grouping name for a task packet.
 *
 * @param {TaskPacket} taskPacket Packet to key
 * @returns {string} Mission set name or UNNAMED_MISSION_SET_KEY
 */
export function missionSetKeyOf(taskPacket: TaskPacket): string {
    return taskPacket.mission_name ? taskPacket.mission_name : UNNAMED_MISSION_SET_KEY;
}

/**
 * Groups task packets into mission set summaries sorted by start time. Packets with no
 * mission_name are grouped under UNNAMED so they aren't missed. Included and excluded packets
 * are counted together in taskPacketCount, with excludedTaskPacketCount tracking how many of a
 * mission set's packets the user has individually excluded.
 *
 * @param {TaskPacket[]} includedTaskPackets Packets shown on the map
 * @param {TaskPacket[]} excludedTaskPackets Packets individually excluded by the user
 * @returns {MissionSetSummary[]} Summaries sorted by startTime ascending
 */
export function buildMissionSetSummaries(
    includedTaskPackets: TaskPacket[],
    excludedTaskPackets: TaskPacket[],
): MissionSetSummary[] {
    const byKey = new Map<string, MissionSetSummary>();

    const addPacket = (taskPacket: TaskPacket, isExcluded: boolean) => {
        const startTime = Number(taskPacket.start_time);
        if (!Number.isFinite(startTime)) {
            return;
        }
        const key = missionSetKeyOf(taskPacket);
        const existing = byKey.get(key);
        if (existing) {
            existing.startTime = Math.min(existing.startTime, startTime);
            existing.endTime = Math.max(existing.endTime, startTime);
            existing.taskPacketCount += 1;
            existing.excludedTaskPacketCount += isExcluded ? 1 : 0;
        } else {
            byKey.set(key, {
                key,
                name: taskPacket.mission_name ? taskPacket.mission_name : null,
                startTime,
                endTime: startTime,
                taskPacketCount: 1,
                excludedTaskPacketCount: isExcluded ? 1 : 0,
            });
        }
    };

    for (const taskPacket of includedTaskPackets) {
        addPacket(taskPacket, false);
    }
    for (const taskPacket of excludedTaskPackets) {
        addPacket(taskPacket, true);
    }
    return Array.from(byKey.values()).sort((a, b) => a.startTime - b.startTime);
}

/**
 * Session state for the JCC task packet filter.
 */
export class TaskPacketFilter {
    private active = false;
    private startDate: Date | null = null;
    private endDate: Date | null = null;
    private selectedMissionSetKeys = new Set<string>();
    private sliderLowerUtime = 0;
    private sliderUpperUtime = 0;
    private autoFollowUpper = true;

    isActive() {
        return this.active;
    }

    getStartDate() {
        return this.startDate;
    }

    getEndDate() {
        return this.endDate;
    }

    setSearchWindow(startDate: Date, endDate: Date) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.active = true;
    }

    getSelectedMissionSetKeys() {
        return this.selectedMissionSetKeys;
    }

    setSelectedMissionSetKeys(keys: Set<string>) {
        this.selectedMissionSetKeys = new Set(keys);
    }

    getSliderLowerUtime() {
        return this.sliderLowerUtime;
    }

    getSliderUpperUtime() {
        return this.sliderUpperUtime;
    }

    setSliderWindow(lower: number, upper: number) {
        this.sliderLowerUtime = lower;
        this.sliderUpperUtime = upper;
    }

    getAutoFollowUpper() {
        return this.autoFollowUpper;
    }

    setAutoFollowUpper(autoFollowUpper: boolean) {
        this.autoFollowUpper = autoFollowUpper;
    }

    /**
     * True when a packet should be shown. While active with no mission sets selected nothing
     * passes.
     *
     * @param {TaskPacket} taskPacket Packet to test
     * @returns {boolean} Whether the packet is visible under the current filter
     */
    passes(taskPacket: TaskPacket): boolean {
        if (!this.active) {
            return true;
        }
        if (!this.selectedMissionSetKeys.has(missionSetKeyOf(taskPacket))) {
            return false;
        }
        if (this.sliderUpperUtime <= 0) {
            return true;
        }
        const startTime = Number(taskPacket.start_time);
        return startTime >= this.sliderLowerUtime && startTime <= this.sliderUpperUtime;
    }

    /**
     * Filters task packets to those visible under the current filter.
     *
     * @param {TaskPacket[]} taskPackets Packets to filter
     * @returns {TaskPacket[]} Visible packets
     */
    filter(taskPackets: TaskPacket[]): TaskPacket[] {
        if (!this.active) {
            return taskPackets;
        }
        return taskPackets.filter((taskPacket) => this.passes(taskPacket));
    }
}

export const taskPacketFilter = new TaskPacketFilter();

import { TaskPacket } from "../../types/protobuf-types";

// Grouping key for task packets that have no mission_name.
export const UNNAMED_MISSION_KEY = "__UNNAMED__";

export interface MissionSummary {
    key: string;
    name: string | null;
    startTime: number;
    endTime: number;
    taskPacketCount: number;
}

/**
 * Returns the grouping name for a task packet.
 *
 * @param {TaskPacket} taskPacket Packet to key
 * @returns {string} Mission name or UNNAMED_MISSION_KEY
 */
export function missionKeyOf(taskPacket: TaskPacket): string {
    return taskPacket.mission_name ? taskPacket.mission_name : UNNAMED_MISSION_KEY;
}

/**
 * Groups task packets into mission summaries sorted by start time. Packets with no
 * mission_name are grouped under UNNAMED so they aren't missed.
 *
 * @param {TaskPacket[]} taskPackets Packets to summarize
 * @returns {MissionSummary[]} Summaries sorted by startTime ascending
 */
export function buildMissionSummaries(taskPackets: TaskPacket[]): MissionSummary[] {
    const byKey = new Map<string, MissionSummary>();
    for (const taskPacket of taskPackets) {
        const startTime = Number(taskPacket.start_time);
        if (!Number.isFinite(startTime)) {
            continue;
        }
        const key = missionKeyOf(taskPacket);
        const existing = byKey.get(key);
        if (existing) {
            existing.startTime = Math.min(existing.startTime, startTime);
            existing.endTime = Math.max(existing.endTime, startTime);
            existing.taskPacketCount += 1;
        } else {
            byKey.set(key, {
                key,
                name: taskPacket.mission_name ? taskPacket.mission_name : null,
                startTime,
                endTime: startTime,
                taskPacketCount: 1,
            });
        }
    }
    return Array.from(byKey.values()).sort((a, b) => a.startTime - b.startTime);
}

/**
 * Session state for the JCC task packet filter.
 */
class TaskPacketFilter {
    private active = false;
    private startDate: Date | null = null;
    private endDate: Date | null = null;
    private selectedMissionKeys = new Set<string>();
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

    getSelectedMissionKeys() {
        return this.selectedMissionKeys;
    }

    setSelectedMissionKeys(keys: Set<string>) {
        this.selectedMissionKeys = new Set(keys);
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
     * True when a packet should be shown. While active with no missions selected nothing
     * passes.
     *
     * @param {TaskPacket} taskPacket Packet to test
     * @returns {boolean} Whether the packet is visible under the current filter
     */
    passes(taskPacket: TaskPacket): boolean {
        if (!this.active) {
            return true;
        }
        if (!this.selectedMissionKeys.has(missionKeyOf(taskPacket))) {
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

    /** Resets to the default unfiltered state. */
    clear() {
        this.active = false;
        this.startDate = null;
        this.endDate = null;
        this.selectedMissionKeys = new Set();
        this.sliderLowerUtime = 0;
        this.sliderUpperUtime = 0;
        this.autoFollowUpper = true;
    }
}

export const taskPacketFilter = new TaskPacketFilter();

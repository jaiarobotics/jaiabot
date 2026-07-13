import { TaskPacket } from "../../types/protobuf-types";

/**
 * Sentinel grouping key for task packets that carry no mission_name. Such packets
 * are grouped under a single "Unnamed" mission rather than being dropped.
 */
export const UNNAMED_MISSION_KEY = "__UNNAMED__";

export interface MissionSummary {
    key: string;
    name: string | null;
    startTime: number;
    endTime: number;
    taskPacketCount: number;
}

/**
 * Returns the grouping key for a task packet: its mission name, or the UNNAMED
 * sentinel when it has none.
 *
 * @param {TaskPacket} taskPacket Packet to key
 * @returns {string} Mission name or UNNAMED_MISSION_KEY
 */
export function missionKeyOf(taskPacket: TaskPacket): string {
    return taskPacket.mission_name ?? UNNAMED_MISSION_KEY;
}

/**
 * Groups task packets into mission summaries (a client-side mirror of the backend
 * MissionSummary). Packets without a mission_name are grouped under UNNAMED so they
 * are never silently dropped.
 *
 * @param {TaskPacket[]} taskPackets Packets to summarize (typically included + excluded)
 * @returns {MissionSummary[]} Summaries sorted by startTime ascending
 */
export function buildMissionSummaries(taskPackets: TaskPacket[]): MissionSummary[] {
    const byKey = new Map<string, MissionSummary>();
    for (const taskPacket of taskPackets) {
        if (taskPacket.start_time === undefined) {
            continue;
        }
        const key = missionKeyOf(taskPacket);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, {
                key,
                name: taskPacket.mission_name ?? null,
                startTime: taskPacket.start_time,
                endTime: taskPacket.start_time,
                taskPacketCount: 1,
            });
        } else {
            existing.startTime = Math.min(existing.startTime, taskPacket.start_time);
            existing.endTime = Math.max(existing.endTime, taskPacket.start_time);
            existing.taskPacketCount += 1;
        }
    }
    return Array.from(byKey.values()).sort((a, b) => a.startTime - b.startTime);
}

/**
 * Holds the state for the JCC task packet filter. This is a plain (non-React)
 * singleton so it can be read both by the React filter panel and by the imperative
 * OpenLayers layers / poll loop. Session-only; never persisted.
 */
class TaskPacketFilter {
    private active = false;
    private startDate: Date | null = null;
    private endDate: Date | null = null;
    private endIsLive = true;
    private selectedMissionKeys = new Set<string>();
    private sliderLowerUtime = 0;
    private sliderUpperUtime = 0;
    private autoFollowUpper = true;

    isActive() {
        return this.active;
    }

    isEngaged() {
        return this.active && this.selectedMissionKeys.size > 0;
    }

    getStartDate() {
        return this.startDate;
    }

    getEndDate() {
        return this.endDate;
    }

    getEndIsLive() {
        return this.endIsLive;
    }

    /**
     * Commits the search window and activates the filter. The poll loop reads this to
     * choose its fetch range.
     *
     * @param {Date} startDate Lower bound of the search window
     * @param {Date} endDate Upper bound of the search window
     * @param {boolean} endIsLive True when the end is "now" (keep following new data)
     * @returns {void}
     */
    setSearchWindow(startDate: Date, endDate: Date, endIsLive: boolean) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.endIsLive = endIsLive;
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
     * True if the packet should be shown on the map. When the filter is not engaged,
     * every packet passes (normal live view).
     *
     * @param {TaskPacket} taskPacket Packet to test
     * @returns {boolean} Whether the packet is visible under the current filter
     */
    passes(taskPacket: TaskPacket): boolean {
        if (!this.isEngaged()) {
            return true;
        }
        if (!this.selectedMissionKeys.has(missionKeyOf(taskPacket))) {
            return false;
        }
        const startTime = taskPacket.start_time;
        if (startTime === undefined) {
            return false;
        }
        return startTime >= this.sliderLowerUtime && startTime <= this.sliderUpperUtime;
    }

    /**
     * Filters a list of task packets to those visible under the current filter.
     *
     * @param {TaskPacket[]} taskPackets Packets to filter
     * @returns {TaskPacket[]} Visible packets (the same array when not engaged)
     */
    filter(taskPackets: TaskPacket[]): TaskPacket[] {
        if (!this.isEngaged()) {
            return taskPackets;
        }
        return taskPackets.filter((taskPacket) => this.passes(taskPacket));
    }

    /** Resets to the default (unfiltered + live) state. */
    clear() {
        this.active = false;
        this.startDate = null;
        this.endDate = null;
        this.endIsLive = true;
        this.selectedMissionKeys = new Set();
        this.sliderLowerUtime = 0;
        this.sliderUpperUtime = 0;
        this.autoFollowUpper = true;
    }
}

export const taskPacketFilter = new TaskPacketFilter();

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
 * The default search window: today from local 00:00 to 23:59.
 *
 * @param {Date} [now] Time to take "today" from
 * @returns {{ start: Date; end: Date }} Window start and end
 *
 * @notes
 * Whole minutes match the minute precision of the task packet query.
 */
export function getTodayWindow(now: Date = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    return {
        start: new Date(year, month, day, 0, 0),
        end: new Date(year, month, day, 23, 59),
    };
}

/**
 * Session state for the JCC task packet filter. The filter is always applied; reset() returns it
 * to today's window with every mission set shown.
 *
 * Mission set selection is stored as the sets the user unchecked, so a mission set that first
 * appears after the filter was set is shown without any bookkeeping.
 */
export class TaskPacketFilter {
    private startDate: Date;
    private endDate: Date;
    private deselectedMissionSetKeys: Set<string>;
    private sliderLowerUtime: number;
    private sliderUpperUtime: number;
    private autoFollowUpper: boolean;

    constructor() {
        this.reset();
    }

    /**
     * Resets the filter to today's window, every mission set shown, and the slider at full range.
     *
     * @returns {void}
     *
     * @notes
     * The window does not roll over at midnight; the operator presses Reset to move to the new day.
     */
    reset() {
        const { start, end } = getTodayWindow();
        this.startDate = start;
        this.endDate = end;
        this.deselectedMissionSetKeys = new Set();
        this.sliderLowerUtime = 0;
        this.sliderUpperUtime = 0;
        this.autoFollowUpper = true;
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
    }

    getDeselectedMissionSetKeys() {
        return new Set(this.deselectedMissionSetKeys);
    }

    setDeselectedMissionSetKeys(keys: Set<string>) {
        this.deselectedMissionSetKeys = new Set(keys);
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
     * True when a packet should be shown: its mission set is not unchecked and it falls within
     * the slider window. While auto-following, the window has no upper bound so new packets show.
     *
     * @param {TaskPacket} taskPacket Packet to test
     * @returns {boolean} Whether the packet is visible under the current filter
     */
    passes(taskPacket: TaskPacket): boolean {
        if (this.deselectedMissionSetKeys.has(missionSetKeyOf(taskPacket))) {
            return false;
        }
        if (this.sliderUpperUtime <= 0) {
            return true;
        }
        const startTime = Number(taskPacket.start_time);
        if (startTime < this.sliderLowerUtime) {
            return false;
        }
        return this.autoFollowUpper || startTime <= this.sliderUpperUtime;
    }

    /**
     * Filters task packets to those visible under the current filter.
     *
     * @param {TaskPacket[]} taskPackets Packets to filter
     * @returns {TaskPacket[]} Visible packets
     */
    filter(taskPackets: TaskPacket[]): TaskPacket[] {
        return taskPackets.filter((taskPacket) => this.passes(taskPacket));
    }
}

export const taskPacketFilter = new TaskPacketFilter();

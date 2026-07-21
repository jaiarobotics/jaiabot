import { getHTMLDateString } from "../../shared/Utilities";
import { taskPacketFilter, MissionSummary } from "../../data/task_packets/task-packet-filter";

const DEFAULT_WINDOW_HOURS = 14; // hours
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

/**
 * Formats a task packet start_time as a datetime.
 *
 * @param {number} utime Timestamp in microseconds
 * @returns {string} Human readable local datetime
 */
export function formatUtime(utime: number) {
    if (!utime) {
        return "--";
    }
    return timeFormatter.format(new Date(utime / 1000));
}

/**
 * Display label for a mission summary ("Unnamed" when it has no mission name).
 *
 * @param {MissionSummary} mission Summary to label
 * @returns {string} Label
 */
export function missionLabel(mission: MissionSummary) {
    return mission.name ?? "Unnamed";
}

/**
 * The default search window: the server's default of the last DEFAULT_WINDOW_HOURS.
 *
 * @returns {{ start: string; end: string }} yyyy-mm-dd date strings
 */
export function getDefaultDateRange() {
    return {
        start: getHTMLDateString(
            new Date(Date.now() - DEFAULT_WINDOW_HOURS * MILLISECONDS_PER_HOUR),
        ),
        end: getHTMLDateString(new Date()),
    };
}

/**
 * Initial start-date string: the active filter's window when present, else the default.
 *
 * @returns {string} yyyy-mm-dd date string
 */
export function getInitialStartDateStr() {
    const start = taskPacketFilter.getStartDate();
    return start ? getHTMLDateString(start) : getDefaultDateRange().start;
}

/**
 * Initial end-date string: the active filter's window when present, else the default.
 *
 * @returns {string} yyyy-mm-dd date string
 */
export function getInitialEndDateStr() {
    const end = taskPacketFilter.getEndDate();
    return end ? getHTMLDateString(end) : getDefaultDateRange().end;
}

/**
 * Whether a search is already active when the panel initiates.
 *
 * @returns {boolean} True when the filter is active
 */
export function getInitialHasSearched() {
    return taskPacketFilter.isActive();
}

/**
 * Initial mission selection, restored from the active filter.
 *
 * @returns {Set<string>} Selected mission keys
 */
export function getInitialSelectedKeys() {
    return new Set(taskPacketFilter.getSelectedMissionKeys());
}

/**
 * Initial slider window restored from the active filter.
 *
 * @returns {[number, number]} Slider utimes in microseconds
 */
export function getInitialSliderWindow(): [number, number] {
    return [taskPacketFilter.getSliderLowerUtime(), taskPacketFilter.getSliderUpperUtime()];
}

/**
 * Builds the "yyyy-mm-dd hh:mm" query strings for the selected date range.
 *
 * @param {string} startDateStr yyyy-mm-dd start date
 * @param {string} endDateStr yyyy-mm-dd end date
 * @returns {{ startQuery: string; endQuery: string }} Query strings for the date range
 */
export function buildQueryStrings(startDateStr: string, endDateStr: string) {
    const startQuery = `${startDateStr} 00:00`;
    const endQuery = `${endDateStr} 23:59`;
    return { startQuery, endQuery };
}

/**
 * Returns the [min, max] start-time range across the selected missions.
 *
 * @param {MissionSummary[]} summaries Mission summaries
 * @param {Set<string>} keys Selected mission keys
 * @returns {[number, number]} Slider bounds, or [0, 0] when nothing is selected
 */
export function computeBounds(summaries: MissionSummary[], keys: Set<string>): [number, number] {
    const selected = summaries.filter((mission) => keys.has(mission.key));
    if (selected.length === 0) {
        return [0, 0];
    }
    const lower = Math.min(...selected.map((mission) => mission.startTime));
    const upper = Math.max(...selected.map((mission) => mission.endTime));
    return [lower, upper];
}

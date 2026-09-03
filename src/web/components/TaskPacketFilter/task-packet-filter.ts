import { getHTMLDateString } from "../../shared/Utilities";
import { TaskPacketFilter, MissionSetSummary } from "../../data/task_packets/task-packet-filter";

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
 * Formats a start-to-end span as a datetime range, collapsing to a single datetime when they match.
 * A mission set groups every packet sharing its name, so its packets can span multiple runs.
 *
 * @param {number} startUtime Earliest timestamp in microseconds
 * @param {number} endUtime Latest timestamp in microseconds
 * @returns {string} Human readable datetime, or "start – end" when they differ
 */
export function formatUtimeRange(startUtime: number, endUtime: number) {
    if (endUtime > startUtime) {
        return `${formatUtime(startUtime)} – ${formatUtime(endUtime)}`;
    }
    return formatUtime(startUtime);
}

/**
 * Display label for a mission set summary ("Unnamed" when it has no mission set name).
 *
 * @param {MissionSetSummary} missionSet Summary to label
 * @returns {string} Label
 */
export function missionSetLabel(missionSet: MissionSetSummary) {
    return missionSet.name ?? "Unnamed";
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
 * @param {TaskPacketFilter} filter Filter to read the window from
 * @returns {string} yyyy-mm-dd date string
 */
export function getInitialStartDateStr(filter: TaskPacketFilter) {
    const start = filter.getStartDate();
    return start ? getHTMLDateString(start) : getDefaultDateRange().start;
}

/**
 * Initial end-date string: the active filter's window when present, else the default.
 *
 * @param {TaskPacketFilter} filter Filter to read the window from
 * @returns {string} yyyy-mm-dd date string
 */
export function getInitialEndDateStr(filter: TaskPacketFilter) {
    const end = filter.getEndDate();
    return end ? getHTMLDateString(end) : getDefaultDateRange().end;
}

/**
 * Whether the filter is already engaged when the panel initiates.
 *
 * @param {TaskPacketFilter} filter Filter to read the active state from
 * @returns {boolean} True when the filter is active
 */
export function getInitialFilterEngaged(filter: TaskPacketFilter) {
    return filter.isActive();
}

/**
 * Initial mission set selection, restored from the active filter.
 *
 * @param {TaskPacketFilter} filter Filter to read the selection from
 * @returns {Set<string>} Selected mission set keys
 */
export function getInitialSelectedKeys(filter: TaskPacketFilter) {
    return new Set(filter.getSelectedMissionSetKeys());
}

/**
 * Initial slider window restored from the active filter.
 *
 * @param {TaskPacketFilter} filter Filter to read the slider window from
 * @returns {[number, number]} Slider utimes in microseconds
 */
export function getInitialSliderWindow(filter: TaskPacketFilter): [number, number] {
    return [filter.getSliderLowerUtime(), filter.getSliderUpperUtime()];
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
 * Returns the [min, max] start-time range across the selected mission sets.
 *
 * @param {MissionSetSummary[]} summaries Mission set summaries
 * @param {Set<string>} keys Selected mission set keys
 * @returns {[number, number]} Slider bounds, or [0, 0] when nothing is selected
 */
export function computeBounds(summaries: MissionSetSummary[], keys: Set<string>): [number, number] {
    const selected = summaries.filter((missionSet) => keys.has(missionSet.key));
    if (selected.length === 0) {
        return [0, 0];
    }
    const lower = Math.min(...selected.map((missionSet) => missionSet.startTime));
    const upper = Math.max(...selected.map((missionSet) => missionSet.endTime));
    return [lower, upper];
}

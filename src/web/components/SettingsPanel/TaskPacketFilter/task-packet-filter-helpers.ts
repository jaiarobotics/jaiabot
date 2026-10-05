import { MissionSetSummary } from "../../../data/task_packets/task-packet-filter";

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
 * Builds the filter window for a pair of date input values: 00:00 on the start date to 23:59 on
 * the end date, local time.
 *
 * @param {string} startDateStr yyyy-mm-dd start date
 * @param {string} endDateStr yyyy-mm-dd end date
 * @returns {{ start: Date; end: Date }} Window start and end
 */
export function toWindowDates(startDateStr: string, endDateStr: string) {
    return {
        start: new Date(`${startDateStr}T00:00`),
        end: new Date(`${endDateStr}T23:59`),
    };
}

/**
 * Keys of the mission sets that are checked: every listed mission set the user hasn't unchecked.
 *
 * @param {MissionSetSummary[]} summaries Listed mission sets
 * @param {Set<string>} deselectedKeys Mission set keys the user unchecked
 * @returns {Set<string>} Checked mission set keys
 */
export function getCheckedKeys(summaries: MissionSetSummary[], deselectedKeys: Set<string>) {
    return new Set(
        summaries.map((missionSet) => missionSet.key).filter((key) => !deselectedKeys.has(key)),
    );
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

/**
 * The slider handle positions for the filter's stored window. An unset window spans the bounds,
 * and while auto-following the upper handle sits at the newest data.
 *
 * @param {[number, number]} bounds Slider bounds from computeBounds
 * @param {number} lowerUtime Filter's slider lower bound
 * @param {number} upperUtime Filter's slider upper bound (0 when unset)
 * @param {boolean} autoFollowUpper Whether the upper handle follows new data
 * @returns {[number, number]} Handle positions in microseconds
 */
export function getSliderValue(
    bounds: [number, number],
    lowerUtime: number,
    upperUtime: number,
    autoFollowUpper: boolean,
): [number, number] {
    if (upperUtime <= 0) {
        return bounds;
    }
    return [lowerUtime, autoFollowUpper ? bounds[1] : upperUtime];
}

import { ChangeEvent, useContext, useEffect, useMemo, useRef, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import {
    buildMissionSetSummaries,
    getTodayWindow,
} from "../../../data/task_packets/task-packet-filter";
import { getHTMLDateString } from "../../../shared/Utilities";
import {
    formatUtime,
    formatUtimeRange,
    missionSetLabel,
    toWindowDates,
    getCheckedKeys,
    computeBounds,
    getSliderValue,
} from "./task-packet-filter-helpers";

import Checkbox from "@mui/material/Checkbox";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";

import "./TaskPacketFilter.less";

const WINDOW_CHANGE_DEBOUNCE_TIME = 400; // milliseconds

/**
 * Task packet filter accordion in the Settings panel. Lets the operator filter which task
 * packets are shown on the map by date range, mission set selection, and time window. The
 * selection and time window are read from the filter in the data model, so the panel always
 * matches the map.
 */
export default function TaskPacketFilter() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const taskPacketFilter = jaiaContext.taskPacketFilter;

    // Date inputs; a valid edit is applied to the filter after a pause in editing.
    const [startDateStr, setStartDateStr] = useState(
        getHTMLDateString(taskPacketFilter.getStartDate()),
    );
    const [endDateStr, setEndDateStr] = useState(getHTMLDateString(taskPacketFilter.getEndDate()));
    const windowChangeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Drop a pending window change when the panel closes.
    useEffect(() => () => clearTimeout(windowChangeTimeoutRef.current), []);

    const taskPacketRevision = jaiaContext.taskPackets.getRevision();
    const missionSets = useMemo(
        () =>
            buildMissionSetSummaries(
                jaiaContext.taskPackets.getIncludedTaskPackets(),
                jaiaContext.taskPackets.getExcludedTaskPackets(),
            ),
        [taskPacketRevision],
    );
    const deselectedKeys = taskPacketFilter.getDeselectedMissionSetKeys();
    const checkedKeys = getCheckedKeys(missionSets, deselectedKeys);
    const areAllMissionSetsChecked =
        missionSets.length > 0 && checkedKeys.size === missionSets.length;

    const sliderBounds = computeBounds(missionSets, checkedKeys);
    const hasSliderData = sliderBounds[1] > 0;
    const sliderValue = getSliderValue(
        sliderBounds,
        taskPacketFilter.getSliderLowerUtime(),
        taskPacketFilter.getSliderUpperUtime(),
        taskPacketFilter.getAutoFollowUpper(),
    );
    const sliderMin = sliderBounds[0];
    const sliderMax = sliderBounds[1] > sliderBounds[0] ? sliderBounds[1] : sliderBounds[0] + 1;
    const sliderStep = Math.max(1, Math.floor((sliderMax - sliderMin) / 500));

    const isDateRangeReversed = startDateStr > endDateStr;

    /**
     * Shows the edited dates and, once editing pauses, applies them to the filter. A reversed range
     * or one matching the current window is not applied.
     *
     * @param {string} nextStartDateStr yyyy-mm-dd start date
     * @param {string} nextEndDateStr yyyy-mm-dd end date
     * @returns {void}
     */
    const changeDateRange = (nextStartDateStr: string, nextEndDateStr: string) => {
        setStartDateStr(nextStartDateStr);
        setEndDateStr(nextEndDateStr);
        clearTimeout(windowChangeTimeoutRef.current);
        if (nextStartDateStr > nextEndDateStr) {
            return;
        }
        const { start, end } = toWindowDates(nextStartDateStr, nextEndDateStr);
        if (
            start.getTime() === taskPacketFilter.getStartDate().getTime() &&
            end.getTime() === taskPacketFilter.getEndDate().getTime()
        ) {
            return;
        }
        windowChangeTimeoutRef.current = setTimeout(() => {
            jaiaDispatch({
                type: JaiaActions.CHANGE_TASK_PACKET_WINDOW,
                filterStartDate: start,
                filterEndDate: end,
            });
        }, WINDOW_CHANGE_DEBOUNCE_TIME);
    };

    /**
     * Updates the start date. An emptied field keeps its last date.
     *
     * @param {ChangeEvent<HTMLInputElement>} event Date input change event
     * @returns {void}
     */
    const handleStartDateChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.value) {
            changeDateRange(event.target.value, endDateStr);
        }
    };

    /**
     * Updates the end date. An emptied field keeps its last date.
     *
     * @param {ChangeEvent<HTMLInputElement>} event Date input change event
     * @returns {void}
     */
    const handleEndDateChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.value) {
            changeDateRange(startDateStr, event.target.value);
        }
    };

    /**
     * Applies a new set of unchecked mission sets to the map.
     *
     * @param {Set<string>} nextDeselectedKeys Mission set keys to hide
     * @returns {void}
     */
    const changeSelection = (nextDeselectedKeys: Set<string>) => {
        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PACKET_SELECTION,
            deselectedMissionSetKeys: nextDeselectedKeys,
        });
    };

    /**
     * Toggles a single mission set.
     *
     * @param {string} key Mission set key to toggle
     * @returns {void}
     */
    const handleToggleMissionSet = (key: string) => {
        const nextDeselectedKeys = new Set(deselectedKeys);
        if (nextDeselectedKeys.has(key)) {
            nextDeselectedKeys.delete(key);
        } else {
            nextDeselectedKeys.add(key);
        }
        changeSelection(nextDeselectedKeys);
    };

    /**
     * Checks every mission set, or unchecks all when they are already all checked.
     *
     * @returns {void}
     */
    const handleToggleSelectAll = () => {
        if (areAllMissionSetsChecked) {
            changeSelection(new Set(missionSets.map((missionSet) => missionSet.key)));
        } else {
            changeSelection(new Set());
        }
    };

    /**
     * Updates the visible time window. The upper handle follows new data while it sits at the
     * newest packet.
     *
     * @param {Event} _event Slider change event
     * @param {number | number[]} value The slider's new [lower, upper] values
     * @returns {void}
     */
    const handleSliderChange = (_event: Event, value: number | number[]) => {
        const [lower, upper] = value as number[];
        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PACKET_SLIDER,
            sliderLowerUtime: lower,
            sliderUpperUtime: upper,
            autoFollowUpper: upper >= sliderBounds[1],
        });
    };

    /**
     * Refreshes the contour to match the window once the user releases the slider.
     *
     * @returns {void}
     */
    const handleSliderCommit = () => {
        jaiaDispatch({ type: JaiaActions.COMMIT_TASK_PACKET_SLIDER });
    };

    /**
     * Resets the filter to today's window with every mission set checked.
     *
     * @returns {void}
     */
    const handleReset = () => {
        clearTimeout(windowChangeTimeoutRef.current);
        const { start, end } = getTodayWindow();
        setStartDateStr(getHTMLDateString(start));
        setEndDateStr(getHTMLDateString(end));
        jaiaDispatch({ type: JaiaActions.RESET_TASK_PACKET_FILTER });
    };

    return (
        <div className="task-packet-filter">
            <p className="task-packet-filter-intro">Filter task packets displayed on the map.</p>

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">Choose a date range</div>
                <div className="task-packet-filter-dates">
                    <label>
                        Start
                        <input
                            type="date"
                            value={startDateStr}
                            max={endDateStr}
                            onChange={handleStartDateChange}
                        />
                    </label>
                    <label>
                        End
                        <input
                            type="date"
                            value={endDateStr}
                            min={startDateStr}
                            onChange={handleEndDateChange}
                        />
                    </label>
                </div>
                {isDateRangeReversed && (
                    <div className="task-packet-filter-hint task-packet-filter-error">
                        Start must be on or before End.
                    </div>
                )}
            </div>

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">Drag to narrow the time window</div>
                <div className="task-packet-filter-slider">
                    <div className="task-packet-filter-slider-labels">
                        <span>{hasSliderData ? formatUtime(sliderValue[0]) : "--"}</span>
                        <span>{hasSliderData ? formatUtime(sliderValue[1]) : "--"}</span>
                    </div>
                    <Slider
                        value={sliderValue}
                        min={sliderMin}
                        max={sliderMax}
                        step={sliderStep}
                        disabled={!hasSliderData}
                        onChange={handleSliderChange}
                        onChangeCommitted={handleSliderCommit}
                    />
                </div>
            </div>

            {missionSets.length > 0 && (
                <div className="task-packet-filter-step task-packet-filter-results-step">
                    <div className="task-packet-filter-step-header">
                        <div className="task-packet-filter-step-label">
                            Select mission sets to show on the map
                        </div>
                        <Button size="small" color="inherit" onClick={handleToggleSelectAll}>
                            {areAllMissionSetsChecked ? "Deselect all" : "Select all"}
                        </Button>
                    </div>
                    <div className="task-packet-filter-results">
                        {missionSets.map((missionSet) => (
                            <label className="task-packet-filter-result-row" key={missionSet.key}>
                                <Checkbox
                                    size="small"
                                    checked={checkedKeys.has(missionSet.key)}
                                    onChange={() => handleToggleMissionSet(missionSet.key)}
                                />
                                <div className="task-packet-filter-result-info">
                                    <span className="task-packet-filter-result-name">
                                        {missionSetLabel(missionSet)}
                                    </span>
                                    <span className="task-packet-filter-result-meta">
                                        {formatUtimeRange(missionSet.startTime, missionSet.endTime)}{" "}
                                        · {missionSet.taskPacketCount} packets
                                        {missionSet.excludedTaskPacketCount > 0 &&
                                            ` (${missionSet.excludedTaskPacketCount} excluded)`}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>
                    {checkedKeys.size === 0 && (
                        <div className="task-packet-filter-hint">
                            Check one or more mission sets to filter the map.
                        </div>
                    )}
                </div>
            )}

            <Button
                className="task-packet-filter-reset"
                variant="outlined"
                color="inherit"
                onClick={handleReset}
            >
                Reset
            </Button>
        </div>
    );
}

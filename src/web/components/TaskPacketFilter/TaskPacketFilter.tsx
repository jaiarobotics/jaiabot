import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import {
    buildMissionSetSummaries,
    MissionSetSummary,
} from "../../data/task_packets/task-packet-filter";
import { TaskPacket } from "../../types/protobuf-types";
import { jaiaAPI } from "../../utils/jaia-api";
import {
    formatUtime,
    formatUtimeRange,
    missionSetLabel,
    getDefaultDateRange,
    getInitialStartDateStr,
    getInitialEndDateStr,
    getInitialFilterEngaged,
    getInitialSelectedKeys,
    getInitialSliderWindow,
    buildQueryStrings,
    computeBounds,
} from "./task-packet-filter";

import Checkbox from "@mui/material/Checkbox";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";

import "./TaskPacketFilter.less";

const FETCH_DEBOUNCE_TIME = 400; // milliseconds
const ONE_DAY_MICROS = 24 * 60 * 60 * 1000 * 1000; // microseconds

/**
 * Task packet filter accordion in the Settings panel. Lets the operator filter which task
 * packets are shown on the map by date range, mission set selection, and time window.
 */
export default function TaskPacketFilter() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const taskPacketFilter = jaiaContext.taskPacketFilter;

    // Filter setup state
    const [startDateStr, setStartDateStr] = useState(getInitialStartDateStr(taskPacketFilter));
    const [endDateStr, setEndDateStr] = useState(getInitialEndDateStr(taskPacketFilter));
    const [isFilterEngaged, setIsFilterEngaged] = useState(
        getInitialFilterEngaged(taskPacketFilter),
    );
    // Blanks the date inputs after Clear Filter until the user interacts with the panel again.
    const [isDateRangeBlank, setIsDateRangeBlank] = useState(false);

    // Results / selection state
    const [missionSets, setMissionSets] = useState<MissionSetSummary[]>([]);
    const [selectedKeys, setSelectedKeys] = useState(getInitialSelectedKeys(taskPacketFilter));
    const [sliderBounds, setSliderBounds] = useState(getInitialSliderWindow(taskPacketFilter));
    const [sliderValue, setSliderValue] = useState(getInitialSliderWindow(taskPacketFilter));

    // Latest values so the version-driven live effect can read them without re-subscribing.
    const missionSetsRef = useRef(missionSets);
    const selectedKeysRef = useRef(selectedKeys);
    const skipNextCommitRef = useRef(taskPacketFilter.isActive() && selectedKeys.size > 0);
    const isInitialFetchRef = useRef(true);
    missionSetsRef.current = missionSets;
    selectedKeysRef.current = selectedKeys;

    // On a user date change, fetch the new range and apply it to the map.
    useEffect(() => scheduleMissionRefresh(), [startDateStr, endDateStr]);

    // Apply the mission set selection to the map whenever it changes.
    useEffect(() => commitMissionSetSelection(), [selectedKeys]);

    // Pick up new task packets.
    const taskPacketRevision = jaiaContext.taskPackets.getRevision();
    useEffect(() => followLatestTaskPackets(), [taskPacketRevision]);

    // On first open with no active filter, show the full default date range (same as Clear) rather
    // than the rolling live window. A reopened active filter is restored by the effect above.
    useEffect(() => {
        if (!taskPacketFilter.isActive()) {
            applyDateRange(startDateStr, endDateStr);
        }
    }, []);

    /**
     * Schedules a debounced fetch for the current date range on a user date change. Skips the run on
     * mount: the mount effect applies the default range on a fresh open, and the live-sync effect
     * restores a reopened filter.
     *
     * @returns {(() => void) | undefined} Cleanup that cancels the pending fetch, if scheduled
     */
    const scheduleMissionRefresh = () => {
        if (isInitialFetchRef.current) {
            isInitialFetchRef.current = false;
            return;
        }
        const timeoutID = setTimeout(
            () => applyDateRange(startDateStr, endDateStr),
            FETCH_DEBOUNCE_TIME,
        );
        return () => clearTimeout(timeoutID);
    };

    /**
     * Fetches task packets for the given date range, rebuilds the mission set list, and applies the
     * range to the map with every mission set in it selected. Used on a user-driven date change and
     * by Clear Filter to return to the default range.
     *
     * @param {string} startStr yyyy-mm-dd range start
     * @param {string} endStr yyyy-mm-dd range end
     * @returns {Promise<void>}
     */
    const applyDateRange = async (startStr: string, endStr: string) => {
        const { startQuery, endQuery } = buildQueryStrings(startStr, endStr);
        try {
            const response = await jaiaAPI.getTaskPackets(startQuery, endQuery);
            const included = response?.result?.included ?? [];
            const excluded = response?.result?.excluded ?? [];
            const summaries = buildMissionSetSummaries(included, excluded);
            setMissionSets(summaries);
            missionSetsRef.current = summaries;

            const nextSelection = new Set(summaries.map((missionSet) => missionSet.key));
            activateFilter(included, excluded, summaries, nextSelection, startStr, endStr);
        } catch (error) {
            console.error(error);
            setMissionSets([]);
        }
    };

    /**
     * Applies the current mission set selection to the data model and repaints the map. Skips the
     * commit right after activateFilter, which already applied the selection.
     *
     * @returns {void}
     */
    const commitMissionSetSelection = () => {
        if (skipNextCommitRef.current) {
            skipNextCommitRef.current = false;
            return;
        }

        if (!isFilterEngaged || !taskPacketFilter.isActive()) {
            return;
        }

        if (selectedKeys.size > 0) {
            const bounds = computeBounds(missionSetsRef.current, selectedKeys);
            setSliderBounds(bounds);
            setSliderValue(bounds);
        }

        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PACKET_SELECTION,
            selectedMissionSetKeys: selectedKeys,
        });
    };

    /**
     * Mirrors the unfiltered live map in the panel: rebuilds the mission set list from the shared
     * model with every mission set selected and the slider spanning them all. Used while the filter
     * is inactive so the panel always matches the map.
     *
     * @returns {void}
     */
    const mirrorModelToPanel = () => {
        const summaries = buildMissionSetSummaries(
            jaiaContext.taskPackets.getIncludedTaskPackets(),
            jaiaContext.taskPackets.getExcludedTaskPackets(),
        );
        setMissionSets(summaries);
        missionSetsRef.current = summaries;
        const allKeys = new Set(summaries.map((missionSet) => missionSet.key));
        setSelectedKeys(allKeys);
        selectedKeysRef.current = allKeys;
        const bounds = computeBounds(summaries, allKeys);
        setSliderBounds(bounds);
        setSliderValue(bounds);
    };

    /**
     * Keeps the panel in step with the latest task packets. While the filter is not engaged the map
     * shows every live packet, so the panel mirrors it (all mission sets selected). While engaged it
     * rebuilds the list and extends the slider to follow the newest data. Runs on each task packet
     * update.
     *
     * @returns {void}
     */
    const followLatestTaskPackets = () => {
        if (!taskPacketFilter.isActive()) {
            mirrorModelToPanel();
            return;
        }

        const summaries = buildMissionSetSummaries(
            jaiaContext.taskPackets.getIncludedTaskPackets(),
            jaiaContext.taskPackets.getExcludedTaskPackets(),
        );
        setMissionSets(summaries);
        missionSetsRef.current = summaries;

        if (selectedKeysRef.current.size === 0) {
            return;
        }

        const bounds = computeBounds(summaries, selectedKeysRef.current);
        if (bounds[0] === 0 && bounds[1] === 0) {
            return;
        }
        setSliderBounds(bounds);

        if (taskPacketFilter.getSliderUpperUtime() <= 0) {
            // When slider not dragged yet track the full range.
            setSliderValue(bounds);
        } else if (taskPacketFilter.getAutoFollowUpper()) {
            setSliderValue((current) => [current[0], bounds[1]]);
            jaiaDispatch({
                type: JaiaActions.CHANGE_TASK_PACKET_SLIDER,
                sliderLowerUtime: taskPacketFilter.getSliderLowerUtime(),
                sliderUpperUtime: bounds[1],
                autoFollowUpper: true,
            });
        }
    };

    /**
     * Activates the filter for the current date range and selection: loads the fetched packets
     * into the shared model, sets the window, and shows the slider spanning the selection. Both the
     * map and list read from the same fetched data so they always agree.
     *
     * @param {TaskPacket[]} included Included task packets from the current fetch
     * @param {TaskPacket[]} excluded Excluded task packets from the current fetch
     * @param {MissionSetSummary[]} summaries Mission set summaries built from the fetch
     * @param {Set<string>} selection Mission set keys to show on the map
     * @param {string} startStr yyyy-mm-dd window start
     * @param {string} endStr yyyy-mm-dd window end
     * @returns {void}
     */
    const activateFilter = (
        included: TaskPacket[],
        excluded: TaskPacket[],
        summaries: MissionSetSummary[],
        selection: Set<string>,
        startStr: string,
        endStr: string,
    ) => {
        // Set the slider from the data just loaded so it appears immediately and matches the list.
        const bounds = computeBounds(summaries, selection);
        setSliderBounds(bounds);
        setSliderValue(bounds);

        // This action applies the selection and repaints the map, so skip the selection effect that
        // the setSelectedKeys call below would otherwise trigger and which would repeat the work.
        skipNextCommitRef.current = true;
        jaiaDispatch({
            type: JaiaActions.RUN_TASK_PACKET_SEARCH,
            includedTaskPackets: included,
            excludedTaskPackets: excluded,
            filterStartDate: new Date(`${startStr}T00:00:00`),
            filterEndDate: new Date(`${endStr}T23:59:59`),
            selectedMissionSetKeys: selection,
        });
        setSelectedKeys(selection);
        setIsFilterEngaged(true);
    };

    /**
     * Applies a new mission set selection to the map. The first change engages the filter using the
     * live packets already on the map; later changes update the selection live.
     *
     * @param {Set<string>} next Mission set keys to show on the map
     * @returns {void}
     */
    const applyMissionSetSelection = (next: Set<string>) => {
        setIsDateRangeBlank(false);
        if (isFilterEngaged) {
            setSelectedKeys(next);
        } else {
            activateFilter(
                jaiaContext.taskPackets.getIncludedTaskPackets(),
                jaiaContext.taskPackets.getExcludedTaskPackets(),
                missionSetsRef.current,
                next,
                startDateStr,
                endDateStr,
            );
        }
    };

    /**
     * Toggles a single mission set in the current selection.
     *
     * @param {string} key Mission set key to toggle
     * @returns {void}
     */
    const handleToggleMissionSet = (key: string) => {
        const next = new Set(selectedKeys);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        applyMissionSetSelection(next);
    };

    /**
     * Selects every mission set, or deselects all when they are already all selected.
     *
     * @returns {void}
     */
    const handleToggleSelectAll = () => {
        if (missionSets.every((missionSet) => selectedKeys.has(missionSet.key))) {
            applyMissionSetSelection(new Set());
        } else {
            applyMissionSetSelection(new Set(missionSets.map((missionSet) => missionSet.key)));
        }
    };

    /**
     * Updates the start date. Changing the range rebuilds the mission set list and re-applies the
     * filter to the new range, selecting every mission set it contains.
     *
     * @param {ChangeEvent<HTMLInputElement>} event Date input change event
     * @returns {void}
     */
    const handleStartDateChange = (event: ChangeEvent<HTMLInputElement>) => {
        setStartDateStr(event.target.value);
        setIsDateRangeBlank(false);
    };

    /**
     * Updates the end date. Changing the range rebuilds the mission set list and re-applies the
     * filter to the new range, selecting every mission set it contains.
     *
     * @param {ChangeEvent<HTMLInputElement>} event Date input change event
     * @returns {void}
     */
    const handleEndDateChange = (event: ChangeEvent<HTMLInputElement>) => {
        setEndDateStr(event.target.value);
        setIsDateRangeBlank(false);
    };

    /**
     * Updates the visible time window. The first drag engages the filter (with every mission set
     * selected) so narrowing the window takes effect on the map.
     *
     * @param {number | number[]} value The slider's new [lower, upper] values
     * @returns {void}
     */
    const handleSliderChange = (_event: Event, value: number | number[]) => {
        setIsDateRangeBlank(false);
        const [lower, upper] = value as number[];
        setSliderValue([lower, upper]);
        if (!taskPacketFilter.isActive()) {
            jaiaDispatch({
                type: JaiaActions.RUN_TASK_PACKET_SEARCH,
                includedTaskPackets: jaiaContext.taskPackets.getIncludedTaskPackets(),
                excludedTaskPackets: jaiaContext.taskPackets.getExcludedTaskPackets(),
                filterStartDate: new Date(`${startDateStr}T00:00:00`),
                filterEndDate: new Date(`${endDateStr}T23:59:59`),
                selectedMissionSetKeys: selectedKeysRef.current,
            });
            setIsFilterEngaged(true);
        }
        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PACKET_SLIDER,
            sliderLowerUtime: lower,
            sliderUpperUtime: upper,
            // Auto-follow only while the upper handle sits at (or beyond) the newest data.
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
     * Clears the filter.
     *
     * @returns {void}
     */
    const handleClear = () => {
        // Reset to the default date range with every mission set shown, so the map matches the date
        // range the panel resets to (rather than the server's narrower rolling default). Blank the
        // date inputs until the user interacts again.
        const defaultDateRange = getDefaultDateRange();
        // We fetch the default range here, so skip the fetch the date effect would otherwise run.
        if (startDateStr !== defaultDateRange.start || endDateStr !== defaultDateRange.end) {
            isInitialFetchRef.current = true;
        }
        setIsDateRangeBlank(true);
        setStartDateStr(defaultDateRange.start);
        setEndDateStr(defaultDateRange.end);
        applyDateRange(defaultDateRange.start, defaultDateRange.end);
    };

    const areAllMissionSetsSelected =
        missionSets.length > 0 &&
        missionSets.every((missionSet) => selectedKeys.has(missionSet.key));

    const sliderMin = sliderBounds[0];
    const sliderMax = sliderBounds[1] > sliderBounds[0] ? sliderBounds[1] : sliderBounds[0] + 1;
    const sliderStep = Math.max(1, Math.floor((sliderMax - sliderMin) / 500));

    // The time window only makes sense within a single day, so show the slider only when the
    // available task packets span less than a day and remove it entirely otherwise.
    const showSlider = sliderBounds[1] > 0 && sliderBounds[1] - sliderBounds[0] < ONE_DAY_MICROS;

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
                            value={isDateRangeBlank ? "" : startDateStr}
                            onChange={handleStartDateChange}
                        />
                    </label>
                    <label>
                        End
                        <input
                            type="date"
                            value={isDateRangeBlank ? "" : endDateStr}
                            onChange={handleEndDateChange}
                        />
                    </label>
                </div>
            </div>

            {showSlider && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-label">
                        Drag to narrow the time window
                    </div>
                    <div className="task-packet-filter-slider">
                        <div className="task-packet-filter-slider-labels">
                            <span>{formatUtime(sliderValue[0])}</span>
                            <span>{formatUtime(sliderValue[1])}</span>
                        </div>
                        <Slider
                            value={sliderValue}
                            min={sliderMin}
                            max={sliderMax}
                            step={sliderStep}
                            onChange={handleSliderChange}
                            onChangeCommitted={handleSliderCommit}
                        />
                    </div>
                </div>
            )}

            {missionSets.length > 0 && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-header">
                        <div className="task-packet-filter-step-label">
                            Select mission sets to show on the map
                        </div>
                        <Button
                            size="small"
                            onClick={handleToggleSelectAll}
                            className="task-packet-filter-select-all-button"
                        >
                            {areAllMissionSetsSelected ? "Deselect all" : "Select all"}
                        </Button>
                    </div>
                    <div className="task-packet-filter-results">
                        {missionSets.map((missionSet) => (
                            <label className="task-packet-filter-result-row" key={missionSet.key}>
                                <Checkbox
                                    size="small"
                                    checked={selectedKeys.has(missionSet.key)}
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
                    {selectedKeys.size === 0 && (
                        <div className="task-packet-filter-hint">
                            Check one or more mission sets to filter the map.
                        </div>
                    )}
                </div>
            )}

            <Button
                variant="outlined"
                onClick={handleClear}
                className="task-packet-filter-clear-button"
            >
                Clear Filter
            </Button>
        </div>
    );
}

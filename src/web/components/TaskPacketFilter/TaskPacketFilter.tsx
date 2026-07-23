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

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";

import "./TaskPacketFilter.less";

const SEARCH_DEBOUNCE_TIME = 400; // milliseconds

/**
 * Task packet filter accordion in the Settings panel. Lets the operator filter which task
 * packets are shown on the map. Filter options are date range, mission set name, and time window.
 */
export default function TaskPacketFilter() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const taskPacketFilter = jaiaContext.taskPacketFilter;

    // Search setup state
    const [startDateStr, setStartDateStr] = useState(getInitialStartDateStr(taskPacketFilter));
    const [endDateStr, setEndDateStr] = useState(getInitialEndDateStr(taskPacketFilter));
    const [nameFilter, setNameFilter] = useState<string[]>([]);
    const [isFilterEngaged, setIsFilterEngaged] = useState(
        getInitialFilterEngaged(taskPacketFilter),
    );

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
    // Packets from the latest date-range fetch, reused to engage the filter without re-fetching.
    const fetchedIncludedRef = useRef<TaskPacket[]>([]);
    const fetchedExcludedRef = useRef<TaskPacket[]>([]);
    missionSetsRef.current = missionSets;
    selectedKeysRef.current = selectedKeys;

    // Refresh the mission set list on date change, and apply the new range to the map.
    useEffect(() => scheduleMissionRefresh(), [startDateStr, endDateStr]);

    // Apply the mission set selection to the map whenever it changes.
    useEffect(() => commitMissionSetSelection(), [selectedKeys]);

    // Pick up new task packets so the slider can follow. The poll updates
    // the task packet version, which re-triggers this effect.
    const taskPacketVersion = jaiaContext.taskPackets.getVersion();
    useEffect(() => followLatestTaskPackets(), [taskPacketVersion]);

    /**
     * Refresh the mission set list for the current date range.
     *
     * @returns {() => void} Cleanup that cancels the pending refresh
     */
    const scheduleMissionRefresh = () => {
        const isInitial = isInitialFetchRef.current;
        isInitialFetchRef.current = false;
        const timeoutID = setTimeout(() => {
            fetchMissions(isInitial);
        }, SEARCH_DEBOUNCE_TIME);
        return () => clearTimeout(timeoutID);
    };

    /**
     * Fetches task packets for the current date range and rebuilds the mission set list. On a
     * user-driven date change (not the initial load) it also applies the new range to the map.
     *
     * @param {boolean} isInitial True for the first fetch (mount/reopen), which only builds the
     *     list and never activates the filter
     * @returns {Promise<void>}
     */
    const fetchMissions = async (isInitial: boolean) => {
        const { startQuery, endQuery } = buildQueryStrings(startDateStr, endDateStr);
        try {
            const response = await jaiaAPI.getTaskPackets(startQuery, endQuery);
            const included = response?.result?.included ?? [];
            const excluded = response?.result?.excluded ?? [];
            fetchedIncludedRef.current = included;
            fetchedExcludedRef.current = excluded;
            const summaries = buildMissionSetSummaries(included, excluded);
            setMissionSets(summaries);
            missionSetsRef.current = summaries;

            if (isInitial) {
                // Reopen with an active filter: the window is already applied. Restore the slider.
                if (taskPacketFilter.isActive() && selectedKeysRef.current.size > 0) {
                    const bounds = computeBounds(summaries, selectedKeysRef.current);
                    setSliderBounds(bounds);
                    if (sliderValue[0] === 0 && sliderValue[1] === 0) {
                        setSliderValue(bounds);
                    }
                }
                return;
            }

            // A date change is a user change, so apply the new range to the map immediately,
            // selecting every mission set in range (honoring the optional name filter).
            const nextSelection = new Set(
                (nameFilter.length > 0
                    ? summaries.filter((missionSet) =>
                          nameFilter.includes(missionSetLabel(missionSet)),
                      )
                    : summaries
                ).map((missionSet) => missionSet.key),
            );
            activateFilter(included, excluded, summaries, nextSelection);
        } catch (error) {
            console.error(error);
            setMissionSets([]);
        }
    };

    /**
     * Applies the current mission set selection to the data model and repaints the map. Skips the
     * commit right after a search.
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
     * Rebuilds the mission set list from the latest task packets and extends
     * the slider to the newest data. Runs on each task packet update.
     *
     * @returns {void}
     */
    const followLatestTaskPackets = () => {
        if (
            !isFilterEngaged ||
            !taskPacketFilter.isActive() ||
            selectedKeysRef.current.size === 0
        ) {
            return;
        }

        const summaries = buildMissionSetSummaries(
            jaiaContext.taskPackets.getIncludedTaskPackets(),
            jaiaContext.taskPackets.getExcludedTaskPackets(),
        );
        setMissionSets(summaries);
        missionSetsRef.current = summaries;

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
     * @returns {void}
     */
    const activateFilter = (
        included: TaskPacket[],
        excluded: TaskPacket[],
        summaries: MissionSetSummary[],
        selection: Set<string>,
    ) => {
        // Set the slider from the data just loaded so it appears immediately and matches the list.
        const bounds = computeBounds(summaries, selection);
        setSliderBounds(bounds);
        setSliderValue(bounds);

        // The search action applies the selection and re-renders, so skip the effect that would
        // otherwise also initiate from setSelectedKeys and repeat the work.
        skipNextCommitRef.current = true;
        jaiaDispatch({
            type: JaiaActions.RUN_TASK_PACKET_SEARCH,
            includedTaskPackets: included,
            excludedTaskPackets: excluded,
            filterStartDate: new Date(`${startDateStr}T00:00:00`),
            filterEndDate: new Date(`${endDateStr}T23:59:59`),
            selectedMissionSetKeys: selection,
        });
        setSelectedKeys(selection);
        setIsFilterEngaged(true);
    };

    /**
     * Toggles a mission set to be included in the current selection. The first toggle engages the
     * filter using the packets already fetched; later toggles update the selection live.
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

        if (isFilterEngaged) {
            setSelectedKeys(next);
        } else {
            activateFilter(
                fetchedIncludedRef.current,
                fetchedExcludedRef.current,
                missionSetsRef.current,
                next,
            );
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
        setIsFilterEngaged(false);
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
        setIsFilterEngaged(false);
    };

    /**
     * Updates the visible time window.
     *
     * @param {number | number[]} value The slider's new [lower, upper] values
     * @returns {void}
     */
    const handleSliderChange = (_event: Event, value: number | number[]) => {
        const [lower, upper] = value as number[];
        setSliderValue([lower, upper]);
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
        // Reset the date range back to the default window and return to the default live
        // view, so the panel's dates always match what the map shows.
        const defaultDateRange = getDefaultDateRange();
        setSelectedKeys(new Set());
        setIsFilterEngaged(false);
        setNameFilter([]);
        setMissionSets([]);
        setSliderBounds([0, 0]);
        setSliderValue([0, 0]);
        setStartDateStr(defaultDateRange.start);
        setEndDateStr(defaultDateRange.end);
        jaiaDispatch({ type: JaiaActions.CLEAR_TASK_PACKET_FILTER });
    };

    const missionSetOptions = missionSets.map(missionSetLabel);
    const resultMissionSets =
        nameFilter.length > 0
            ? missionSets.filter((missionSet) => nameFilter.includes(missionSetLabel(missionSet)))
            : missionSets;

    const sliderMin = sliderBounds[0];
    const sliderMax = sliderBounds[1] > sliderBounds[0] ? sliderBounds[1] : sliderBounds[0] + 1;
    const sliderStep = Math.max(1, Math.floor((sliderMax - sliderMin) / 500));

    // The time window only makes sense within a single day, so disable it when the date
    // range spans more than one day.
    const isMultiDayRange = startDateStr !== endDateStr;

    return (
        <div className="task-packet-filter">
            <p className="task-packet-filter-intro">Filter task packets displayed on the map.</p>

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">1. Choose a date range</div>
                <div className="task-packet-filter-dates">
                    <label>
                        Start
                        <input type="date" value={startDateStr} onChange={handleStartDateChange} />
                    </label>
                    <label>
                        End
                        <input type="date" value={endDateStr} onChange={handleEndDateChange} />
                    </label>
                </div>
            </div>

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">
                    2. Filter by mission set name (optional)
                </div>
                <Autocomplete
                    multiple
                    size="small"
                    options={missionSetOptions}
                    value={nameFilter}
                    onChange={(_event, value) => setNameFilter(value)}
                    renderInput={(params) => (
                        <TextField {...params} placeholder="All mission sets" />
                    )}
                />
            </div>

            {missionSets.length > 0 && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-label">
                        3. Select mission sets to show on the map
                    </div>
                    {resultMissionSets.length === 0 ? (
                        <div className="task-packet-filter-hint">
                            No mission sets found in this date range.
                        </div>
                    ) : (
                        <>
                            <div className="task-packet-filter-results">
                                {resultMissionSets.map((missionSet) => (
                                    <label
                                        className="task-packet-filter-result-row"
                                        key={missionSet.key}
                                    >
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
                                                {formatUtime(missionSet.startTime)} ·{" "}
                                                {missionSet.taskPacketCount} packets
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
                        </>
                    )}
                </div>
            )}

            {isFilterEngaged && selectedKeys.size > 0 && sliderBounds[1] > 0 && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-label">
                        4. Drag to narrow the time window
                    </div>
                    {isMultiDayRange && (
                        <div className="task-packet-filter-hint">
                            Choose a single-day date range to narrow the time window.
                        </div>
                    )}
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
                            disabled={isMultiDayRange}
                            onChange={handleSliderChange}
                            onChangeCommitted={handleSliderCommit}
                        />
                    </div>
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

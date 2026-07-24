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
const ONE_DAY_MICROS = 24 * 60 * 60 * 1000 * 1000; // microseconds

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

    /**
     * Schedules a fetch for the current date range. Skips the initial run on mount: the
     * live-sync effect populates the list from the shared model (and restores a reopened filter),
     * so a fetch is only needed once the user changes the date range.
     *
     * @returns {(() => void) | undefined} Cleanup that cancels the pending fetch, if scheduled
     */
    const scheduleMissionRefresh = () => {
        if (isInitialFetchRef.current) {
            isInitialFetchRef.current = false;
            return;
        }
        const timeoutID = setTimeout(fetchMissions, SEARCH_DEBOUNCE_TIME);
        return () => clearTimeout(timeoutID);
    };

    /**
     * Fetches task packets for the current date range, rebuilds the mission set list, and applies
     * the new range to the map, selecting every mission set in range (honoring the optional name
     * filter). Runs on a user-driven date change.
     *
     * @returns {Promise<void>}
     */
    const fetchMissions = async () => {
        const { startQuery, endQuery } = buildQueryStrings(startDateStr, endDateStr);
        try {
            const response = await jaiaAPI.getTaskPackets(startQuery, endQuery);
            const included = response?.result?.included ?? [];
            const excluded = response?.result?.excluded ?? [];
            const summaries = buildMissionSetSummaries(included, excluded);
            setMissionSets(summaries);
            missionSetsRef.current = summaries;

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
     * filter using the live packets already on the map; later toggles update the selection live.
     *
     * @param {string} key Mission set key to toggle
     * @returns {void}
     */
    const handleToggleMissionSet = (key: string) => {
        setIsDateRangeBlank(false);
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
                jaiaContext.taskPackets.getIncludedTaskPackets(),
                jaiaContext.taskPackets.getExcludedTaskPackets(),
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
        setIsFilterEngaged(false);
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
        // Reset the date range back to the default window so the panel's dates match the live view.
        // If that changes the dates, skip the fetch the date effect would otherwise run, since it
        // would re-activate the filter we are clearing.
        const defaultDateRange = getDefaultDateRange();
        if (startDateStr !== defaultDateRange.start || endDateStr !== defaultDateRange.end) {
            isInitialFetchRef.current = true;
        }
        setIsFilterEngaged(false);
        setIsDateRangeBlank(true);
        setNameFilter([]);
        setStartDateStr(defaultDateRange.start);
        setEndDateStr(defaultDateRange.end);
        jaiaDispatch({ type: JaiaActions.CLEAR_TASK_PACKET_FILTER });

        // Return to the unfiltered live view and mirror it in the panel so the mission set list
        // stays populated instead of disappearing.
        mirrorModelToPanel();
    };

    const missionSetOptions = missionSets.map(missionSetLabel);
    const resultMissionSets =
        nameFilter.length > 0
            ? missionSets.filter((missionSet) => nameFilter.includes(missionSetLabel(missionSet)))
            : missionSets;

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

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">
                    Filter by mission set name (optional)
                </div>
                <Autocomplete
                    multiple
                    size="small"
                    options={missionSetOptions}
                    value={nameFilter}
                    onChange={(_event, value) => {
                        setNameFilter(value);
                        setIsDateRangeBlank(false);
                    }}
                    renderInput={(params) => (
                        <TextField {...params} placeholder="All mission sets" />
                    )}
                />
            </div>

            {missionSets.length > 0 && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-label">
                        Select mission sets to show on the map
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

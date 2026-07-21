import { useEffect, useRef, useState } from "react";

import { syncTaskLayers, syncTaskPacketMarkerLayers } from "../../context/handlers/handler-utils";
import { pollTaskPackets } from "../../jcc/polling";
import { taskPackets } from "../../data/task_packets/task-packets";
import {
    taskPacketFilter,
    buildMissionSummaries,
    MissionSummary,
} from "../../data/task_packets/task-packet-filter";
import { jaiaAPI } from "../../utils/jaia-api";
import {
    formatUtime,
    missionLabel,
    getDefaultDateRange,
    getInitialStartDateStr,
    getInitialEndDateStr,
    getInitialHasSearched,
    getInitialSelectedKeys,
    getInitialSliderWindow,
    buildQueryStrings,
    computeBounds,
} from "./task-packet-filter-helpers";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

import "./TaskPacketFilter.less";

const SEARCH_DEBOUNCE_TIME = 400; // milliseconds
const LIVE_TICK_TIME = 2000; // milliseconds

/**
 * Filter panel that sits beside the settings panel and lets the operator filter which task packets are shown on the map.
 */
export default function TaskPacketFilter() {
    // Search setup state
    const [startDateStr, setStartDateStr] = useState(getInitialStartDateStr);
    const [endDateStr, setEndDateStr] = useState(getInitialEndDateStr);
    const [nameFilter, setNameFilter] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(getInitialHasSearched);

    // Results / selection state
    const [missions, setMissions] = useState<MissionSummary[]>([]);
    const [selectedKeys, setSelectedKeys] = useState(getInitialSelectedKeys);
    const [sliderBounds, setSliderBounds] = useState(getInitialSliderWindow);
    const [sliderValue, setSliderValue] = useState(getInitialSliderWindow);

    // Latest values for use inside the live interval.
    const missionsRef = useRef(missions);
    const selectedKeysRef = useRef(selectedKeys);
    const lastVersionRef = useRef(-1);
    const skipInitialCommitRef = useRef(taskPacketFilter.isActive() && selectedKeys.size > 0);
    const isInitialFetchRef = useRef(true);
    missionsRef.current = missions;
    selectedKeysRef.current = selectedKeys;

    /**
     * Fetches task packets for the current date range and rebuilds the mission list. While
     * a search is active, an actual date-range change also re-applies the window to the map
     * so the current selection keeps filtering the right packets.
     *
     * @param {boolean} isInitial True for the first fetch (mount/reopen), where the window
     *     is already applied and must not be re-fetched
     * @returns {Promise<void>}
     */
    const fetchMissions = async (isInitial: boolean) => {
        const { startQuery, endQuery } = buildQueryStrings(startDateStr, endDateStr);
        setIsLoading(true);
        try {
            const response = await jaiaAPI.getTaskPackets(startQuery, endQuery);
            const included = response?.result?.included ?? [];
            const excluded = response?.result?.excluded ?? [];
            const summaries = buildMissionSummaries([...included, ...excluded]);
            setMissions(summaries);
            missionsRef.current = summaries;

            if (!taskPacketFilter.isActive()) {
                return;
            }

            if (isInitial) {
                // Reopen: the window is already applied; just restore the slider track.
                if (selectedKeysRef.current.size > 0) {
                    const bounds = computeBounds(summaries, selectedKeysRef.current);
                    setSliderBounds(bounds);
                    if (sliderValue[0] === 0 && sliderValue[1] === 0) {
                        setSliderValue(bounds);
                    }
                }
                return;
            }

            // Date range changed: re-apply it to the map, keeping the current selection.
            taskPackets.setIncludedTaskPackets(included);
            taskPackets.setExcludedTaskPackets(excluded);
            taskPacketFilter.setSearchWindow(
                new Date(`${startDateStr}T00:00:00`),
                new Date(`${endDateStr}T23:59:59`),
            );
            const bounds = computeBounds(summaries, selectedKeysRef.current);
            setSliderBounds(bounds);
            setSliderValue(bounds);
            taskPacketFilter.setSliderWindow(0, 0);
            taskPacketFilter.setAutoFollowUpper(true);
            syncTaskLayers();
        } catch (error) {
            console.error(error);
            setMissions([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh the mission list on date change, debounced. The first run (mount/reopen)
    // only refreshes the list; later changes re-apply the window (see fetchMissions).
    useEffect(() => {
        const isInitial = isInitialFetchRef.current;
        isInitialFetchRef.current = false;
        const timeoutID = setTimeout(() => {
            fetchMissions(isInitial);
        }, SEARCH_DEBOUNCE_TIME);
        return () => clearTimeout(timeoutID);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDateStr, endDateStr]);

    // Apply the mission selection to the map whenever it changes.
    useEffect(() => {
        if (skipInitialCommitRef.current) {
            skipInitialCommitRef.current = false;
            return;
        }

        if (!hasSearched || !taskPacketFilter.isActive()) {
            return;
        }

        taskPacketFilter.setSelectedMissionKeys(selectedKeys);

        if (selectedKeys.size > 0) {
            const bounds = computeBounds(missionsRef.current, selectedKeys);
            setSliderBounds(bounds);
            setSliderValue(bounds);
            taskPacketFilter.setSliderWindow(0, 0);
            taskPacketFilter.setAutoFollowUpper(true);
        }

        // Regenerate task packet markers and the contour map to match the filter.
        syncTaskLayers();
    }, [selectedKeys]);

    // Pick up new task packets so counts grow and the slider can follow.
    useEffect(() => {
        if (!hasSearched) {
            return;
        }
        const intervalID = setInterval(() => {
            if (!taskPacketFilter.isActive() || selectedKeysRef.current.size === 0) {
                return;
            }
            const version = taskPackets.getVersion();
            if (version === lastVersionRef.current) {
                return;
            }
            lastVersionRef.current = version;

            const summaries = buildMissionSummaries([
                ...taskPackets.getIncludedTaskPackets(),
                ...taskPackets.getExcludedTaskPackets(),
            ]);
            setMissions(summaries);
            missionsRef.current = summaries;

            const bounds = computeBounds(summaries, selectedKeysRef.current);
            if (bounds[0] === 0 && bounds[1] === 0) {
                return;
            }
            setSliderBounds(bounds);

            if (taskPacketFilter.getSliderUpperUtime() <= 0) {
                // When slider not dragged yet track the full (growing) range.
                setSliderValue(bounds);
            } else if (taskPacketFilter.getAutoFollowUpper()) {
                setSliderValue((current) => [current[0], bounds[1]]);
                taskPacketFilter.setSliderWindow(taskPacketFilter.getSliderLowerUtime(), bounds[1]);
                syncTaskPacketMarkerLayers();
            }
        }, LIVE_TICK_TIME);
        return () => clearInterval(intervalID);
    }, [hasSearched]);

    /**
     * Loads the chosen date range into the shared task packet model, activates the filter,
     * and builds the mission list from that same data so the map and list always agree.
     *
     * @returns {Promise<void>}
     */
    const handleRunSearch = async () => {
        setIsLoading(true);
        const { startQuery, endQuery } = buildQueryStrings(startDateStr, endDateStr);
        try {
            const response = await jaiaAPI.getTaskPackets(startQuery, endQuery);
            const included = response?.result?.included ?? [];
            const excluded = response?.result?.excluded ?? [];

            taskPackets.setIncludedTaskPackets(included);
            taskPackets.setExcludedTaskPackets(excluded);

            const startDateObj = new Date(`${startDateStr}T00:00:00`);
            const endDateObj = new Date(`${endDateStr}T23:59:59`);
            taskPacketFilter.setSearchWindow(startDateObj, endDateObj);

            const summaries = buildMissionSummaries([...included, ...excluded]);
            setMissions(summaries);
            missionsRef.current = summaries;

            const nextSelection = hasSearched
                ? new Set(selectedKeysRef.current)
                : new Set(
                      (nameFilter.length > 0
                          ? summaries.filter((mission) =>
                                nameFilter.includes(missionLabel(mission)),
                            )
                          : summaries
                      ).map((mission) => mission.key),
                  );
            taskPacketFilter.setSelectedMissionKeys(nextSelection);
            setSelectedKeys(nextSelection);
            setHasSearched(true);
        } catch (error) {
            console.error(error);
            setMissions([]);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Toggles a mission to be included in the current selection.
     *
     * @returns {void}
     */
    const handleToggleMission = (key: string) => {
        const next = new Set(selectedKeys);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setSelectedKeys(next);
    };

    /**
     * Updates the visible time window.
     *
     * @returns {void}
     */
    const handleSliderChange = (_event: Event, value: number | number[]) => {
        const [lower, upper] = value as number[];
        setSliderValue([lower, upper]);
        taskPacketFilter.setSliderWindow(lower, upper);
        // Auto-follow only while the upper handle sits at (or beyond) the newest data.
        taskPacketFilter.setAutoFollowUpper(upper >= sliderBounds[1]);
        syncTaskPacketMarkerLayers();
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
        taskPacketFilter.clear();
        setSelectedKeys(new Set());
        setHasSearched(false);
        setNameFilter([]);
        setMissions([]);
        setSliderBounds([0, 0]);
        setSliderValue([0, 0]);
        setStartDateStr(defaultDateRange.start);
        setEndDateStr(defaultDateRange.end);
        pollTaskPackets();
    };

    const missionOptions = missions.map(missionLabel);
    const resultMissions =
        nameFilter.length > 0
            ? missions.filter((mission) => nameFilter.includes(missionLabel(mission)))
            : missions;

    const sliderMin = sliderBounds[0];
    const sliderMax = sliderBounds[1] > sliderBounds[0] ? sliderBounds[1] : sliderBounds[0] + 1;
    const sliderStep = Math.max(1, Math.floor((sliderMax - sliderMin) / 500));

    return (
        <div className="task-packet-filter-panel">
            <p className="task-packet-filter-intro">
                Show only the task packets from specific missions on the map.
            </p>

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">1. Choose a date range</div>
                <div className="task-packet-filter-dates">
                    <label>
                        Start
                        <input
                            type="date"
                            value={startDateStr}
                            onChange={(event) => setStartDateStr(event.target.value)}
                            data-testid="filter-start-date"
                        />
                    </label>
                    <label>
                        End
                        <input
                            type="date"
                            value={endDateStr}
                            onChange={(event) => setEndDateStr(event.target.value)}
                            data-testid="filter-end-date"
                        />
                    </label>
                </div>
            </div>

            <div className="task-packet-filter-step">
                <div className="task-packet-filter-step-label">
                    2. Filter by mission name (optional)
                </div>
                <Autocomplete
                    multiple
                    size="small"
                    options={missionOptions}
                    value={nameFilter}
                    onChange={(_event, value) => setNameFilter(value)}
                    renderInput={(params) => <TextField {...params} placeholder="All missions" />}
                    data-testid="filter-mission-name"
                />
            </div>

            <Button
                variant="contained"
                onClick={handleRunSearch}
                disabled={isLoading}
                className="task-packet-filter-search-button"
            >
                {isLoading ? <CircularProgress size={18} /> : "Run Search"}
            </Button>

            {hasSearched && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-label">
                        3. Select missions to show on the map
                    </div>
                    {resultMissions.length === 0 ? (
                        <div className="task-packet-filter-hint">
                            No missions found in this date range.
                        </div>
                    ) : (
                        <>
                            <div className="task-packet-filter-results">
                                {resultMissions.map((mission) => (
                                    <label
                                        className="task-packet-filter-result-row"
                                        key={mission.key}
                                    >
                                        <Checkbox
                                            size="small"
                                            checked={selectedKeys.has(mission.key)}
                                            onChange={() => handleToggleMission(mission.key)}
                                            data-testid={`filter-mission-${mission.key}`}
                                        />
                                        <div className="task-packet-filter-result-info">
                                            <span className="task-packet-filter-result-name">
                                                {missionLabel(mission)}
                                            </span>
                                            <span className="task-packet-filter-result-meta">
                                                {formatUtime(mission.startTime)} ·{" "}
                                                {mission.taskPacketCount} packets
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {selectedKeys.size === 0 && (
                                <div className="task-packet-filter-hint">
                                    Check one or more missions to filter the map.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {hasSearched && selectedKeys.size > 0 && sliderBounds[1] > 0 && (
                <div className="task-packet-filter-step">
                    <div className="task-packet-filter-step-label">
                        4. Drag to narrow the time window
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
                            onChangeCommitted={() => syncTaskLayers()}
                            data-testid="filter-time-slider"
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

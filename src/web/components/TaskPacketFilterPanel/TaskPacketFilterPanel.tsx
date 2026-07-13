import { useContext, useEffect, useRef, useState } from "react";

import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { syncTaskPacketMarkerLayers } from "../../context/handlers/handler-utils";
import { pollTaskPackets } from "../../jcc/polling";
import { taskPackets } from "../../data/task_packets/task-packets";
import {
    taskPacketFilter,
    buildMissionSummaries,
    MissionSummary,
} from "../../data/task_packets/task-packet-filter";
import { jaiaAPI } from "../../utils/jaia-api";
import { getHTMLDateString } from "../../shared/Utilities";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";

import "./TaskPacketFilterPanel.less";

const SEARCH_DEBOUNCE_TIME = 400; // milliseconds
const LIVE_TICK_TIME = 2000; // milliseconds
const DEFAULT_WINDOW_HOURS = 14; // hours (matches the server's default task packet window)
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

/**
 * Formats a task packet start_time (Unix microseconds) as a short local datetime.
 *
 * @param {number} utime Timestamp in microseconds
 * @returns {string} Human readable local datetime
 */
function formatUtime(utime: number) {
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
function missionLabel(mission: MissionSummary) {
    return mission.name ?? "Unnamed";
}

/**
 * Filter panel that sits beside the settings panel and lets the operator restrict the
 * task packets shown on the map by date range, mission name, and a live time slider.
 */
export default function TaskPacketFilterPanel() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    // ── Search setup state ──────────────────────────────────────────────────
    const [startDateStr, setStartDateStr] = useState(() => {
        const start = taskPacketFilter.getStartDate();
        return start
            ? getHTMLDateString(start)
            : getHTMLDateString(
                  new Date(Date.now() - DEFAULT_WINDOW_HOURS * MILLISECONDS_PER_HOUR),
              );
    });
    const [endDateStr, setEndDateStr] = useState(() => {
        const end = taskPacketFilter.getEndDate();
        return end ? getHTMLDateString(end) : getHTMLDateString(new Date());
    });
    const [nameFilter, setNameFilter] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(() => taskPacketFilter.isActive());

    // ── Results / selection state ───────────────────────────────────────────
    const [missions, setMissions] = useState<MissionSummary[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
        () => new Set(taskPacketFilter.getSelectedMissionKeys()),
    );
    const [sliderBounds, setSliderBounds] = useState<[number, number]>(() => [
        taskPacketFilter.getSliderLowerUtime(),
        taskPacketFilter.getSliderUpperUtime(),
    ]);
    const [sliderValue, setSliderValue] = useState<[number, number]>(() => [
        taskPacketFilter.getSliderLowerUtime(),
        taskPacketFilter.getSliderUpperUtime(),
    ]);

    // Refs mirror latest values for use inside the live-tick interval without
    // re-subscribing the interval on every change.
    const missionsRef = useRef(missions);
    const selectedKeysRef = useRef(selectedKeys);
    const lastVersionRef = useRef(-1);
    // True when the panel mounts with a filter already active (reopened). The first
    // run of the commit effect is skipped so it doesn't clobber the live filter/slider
    // before the mission list has been re-fetched.
    const skipInitialCommitRef = useRef(taskPacketFilter.isActive() && selectedKeys.size > 0);
    missionsRef.current = missions;
    selectedKeysRef.current = selectedKeys;

    /**
     * True when the end date is "today or later" -> keep following live data.
     */
    const isEndLive = () => endDateStr >= getHTMLDateString(new Date());

    /**
     * Builds the "yyyy-mm-dd hh:mm" query strings for the current date range.
     */
    const buildQueryStrings = () => {
        const startQuery = `${startDateStr} 00:00`;
        const endQuery = isEndLive()
            ? `${getHTMLDateString(new Date())} 23:59`
            : `${endDateStr} 23:59`;
        return { startQuery, endQuery };
    };

    /**
     * Recomputes the slider bounds [min startTime, max endTime] across the selected
     * missions of a summary list.
     */
    const computeBounds = (summaries: MissionSummary[], keys: Set<string>): [number, number] => {
        const selected = summaries.filter((mission) => keys.has(mission.key));
        if (selected.length === 0) {
            return [0, 0];
        }
        const lower = Math.min(...selected.map((mission) => mission.startTime));
        const upper = Math.max(...selected.map((mission) => mission.endTime));
        return [lower, upper];
    };

    /**
     * Fetches task packets for the current date range and rebuilds the mission list.
     * Rehydrates the slider bounds when a filter is already active (e.g. on reopen).
     */
    const fetchMissions = async () => {
        const { startQuery, endQuery } = buildQueryStrings();
        setIsLoading(true);
        try {
            const response = await jaiaAPI.getTaskPackets(startQuery, endQuery);
            const included = response?.result?.included ?? [];
            const excluded = response?.result?.excluded ?? [];
            const summaries = buildMissionSummaries([...included, ...excluded]);
            setMissions(summaries);
            missionsRef.current = summaries;

            if (taskPacketFilter.isActive() && selectedKeysRef.current.size > 0) {
                const bounds = computeBounds(summaries, selectedKeysRef.current);
                setSliderBounds(bounds);
                if (sliderValue[0] === 0 && sliderValue[1] === 0) {
                    setSliderValue(bounds);
                }
            }
        } catch (error) {
            console.error(error);
            setMissions([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh the mission list (and autocomplete options) whenever the date range
    // changes, debounced so typing/spinner clicks don't spam the endpoint.
    useEffect(() => {
        const timeoutID = setTimeout(() => {
            fetchMissions();
        }, SEARCH_DEBOUNCE_TIME);
        return () => clearTimeout(timeoutID);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDateStr, endDateStr]);

    // Commit the filter to the map whenever the mission selection changes.
    useEffect(() => {
        // On reopen the singleton is already correct; skip the first run so we don't
        // reset the slider from an empty (not-yet-fetched) mission list.
        if (skipInitialCommitRef.current) {
            skipInitialCommitRef.current = false;
            return;
        }

        if (!hasSearched) {
            return;
        }

        if (selectedKeys.size === 0) {
            // Nothing selected -> return the map to the default live view.
            if (taskPacketFilter.isActive()) {
                taskPacketFilter.clear();
                pollTaskPackets();
            }
            return;
        }

        // Activate the filter for the current window + selection.
        const startDateObj = new Date(`${startDateStr}T00:00:00`);
        const endLive = isEndLive();
        const endDateObj = endLive ? new Date() : new Date(`${endDateStr}T23:59:59`);
        taskPacketFilter.setSearchWindow(startDateObj, endDateObj, endLive);
        taskPacketFilter.setSelectedMissionKeys(selectedKeys);

        const bounds = computeBounds(missionsRef.current, selectedKeys);
        setSliderBounds(bounds);
        setSliderValue(bounds);
        taskPacketFilter.setSliderWindow(bounds[0], bounds[1]);
        taskPacketFilter.setAutoFollowUpper(true);

        // Repaint immediately so already-loaded packets filter without waiting on the
        // network, then load the (possibly wider) window into the map data model.
        syncTaskPacketMarkerLayers();
        pollTaskPackets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKeys]);

    // Live tick: while a filter is engaged, pick up new task packets so mission counts
    // grow and (unless the operator pulled the upper handle back) the slider follows.
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

            if (taskPacketFilter.getAutoFollowUpper()) {
                setSliderValue((current) => [current[0], bounds[1]]);
                taskPacketFilter.setSliderWindow(taskPacketFilter.getSliderLowerUtime(), bounds[1]);
                syncTaskPacketMarkerLayers();
            }
        }, LIVE_TICK_TIME);
        return () => clearInterval(intervalID);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSearched]);

    /**
     * Runs the search: refreshes the mission list and reveals the results.
     */
    const handleRunSearch = async () => {
        await fetchMissions();
        setHasSearched(true);
    };

    /**
     * Toggles a mission's inclusion in the current selection.
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
     * Handles a slider drag: updates the visible time window instantly (no network).
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
     * Clears the filter and returns the map to the default unfiltered live view.
     */
    const handleClear = () => {
        taskPacketFilter.clear();
        setSelectedKeys(new Set());
        setHasSearched(false);
        setNameFilter([]);
        setMissions([]);
        setSliderBounds([0, 0]);
        setSliderValue([0, 0]);
        pollTaskPackets();
    };

    /**
     * Closes the filter panel (leaves any active filter in place).
     */
    const handleClose = () => {
        jaiaDispatch({ type: JaiaActions.TOGGLE_TASK_PACKET_FILTER_PANEL });
    };

    const missionOptions = missions.map(missionLabel);
    const resultMissions =
        nameFilter.length > 0
            ? missions.filter((mission) => nameFilter.includes(missionLabel(mission)))
            : missions;

    // MUI Slider requires min < max; pad a degenerate (single-time) range.
    const sliderMin = sliderBounds[0];
    const sliderMax = sliderBounds[1] > sliderBounds[0] ? sliderBounds[1] : sliderBounds[0] + 1;
    const sliderStep = Math.max(1, Math.floor((sliderMax - sliderMin) / 500));

    return (
        <div className="task-packet-filter-panel">
            <div className="task-packet-filter-header">
                <span className="task-packet-filter-title">Task Packet Filter</span>
                <IconButton size="small" onClick={handleClose} data-testid="close-filter-panel">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>

            <div className="task-packet-filter-dates">
                <label>
                    Start
                    <input
                        type="date"
                        value={startDateStr}
                        max={endDateStr}
                        onChange={(event) => setStartDateStr(event.target.value)}
                        data-testid="filter-start-date"
                    />
                </label>
                <label>
                    End
                    <input
                        type="date"
                        value={endDateStr}
                        min={startDateStr}
                        onChange={(event) => setEndDateStr(event.target.value)}
                        data-testid="filter-end-date"
                    />
                </label>
            </div>

            <Autocomplete
                multiple
                size="small"
                options={missionOptions}
                value={nameFilter}
                onChange={(_event, value) => setNameFilter(value)}
                renderInput={(params) => (
                    <TextField {...params} label="Mission name(s)" placeholder="All missions" />
                )}
                data-testid="filter-mission-name"
            />

            <Button
                variant="contained"
                onClick={handleRunSearch}
                disabled={isLoading}
                className="task-packet-filter-search-button"
            >
                {isLoading ? <CircularProgress size={18} /> : "Run Search"}
            </Button>

            {hasSearched && (
                <div className="task-packet-filter-results">
                    {resultMissions.length === 0 && (
                        <div className="task-packet-filter-empty">
                            No missions in this date range.
                        </div>
                    )}
                    {resultMissions.map((mission) => (
                        <div className="task-packet-filter-result-row" key={mission.key}>
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
                                    {formatUtime(mission.startTime)} · {mission.taskPacketCount}{" "}
                                    packets
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasSearched && selectedKeys.size > 0 && (
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
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => formatUtime(value)}
                        data-testid="filter-time-slider"
                    />
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

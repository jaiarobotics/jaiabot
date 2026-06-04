import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiArrowRight, mdiArrowUp, mdiArrowDown, mdiDelete } from "@mdi/js";
import { Button } from "@mui/material";

import { JCC_CONTAINER, MAX_WAYPOINTS } from "../../../utils/constants";
import {
    listSavedMissionSets,
    loadSnapshotFromLocalStorage,
} from "../MissionSetStorage/mission-set-storage";
import { MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { getMaxWaypointsPerOutputMission } from "./mission-set-editor";
import { formatNumericalInput } from "../../../utils/input";
import SaveAndLoadButton from "./SaveAndLoadButton/SaveAndLoadButton";

import "./MissionSetEditor.less";

interface DialogProps {
    onClose: () => void;
}

interface SavedListItemProps {
    name: string;
    index: number;
    isSelected: boolean;
    onSelect: (index: number) => void;
}

interface CombinedListItemProps {
    name: string;
    index: number;
    isSelected: boolean;
    onSelect: (index: number) => void;
}

/**
 * Dialog for building a combined mission set from multiple saved mission sets.
 * Displays a saved mission sets list and an ordered combination list.
 * Validates waypoint counts before allowing the combined set to be saved and loaded.
 *
 * @param {DialogProps} props.onClose Callback invoked when the dialog is dismissed
 * @returns {React.ReactPortal} Portal-mounted dialog rendered into the JCC container
 */
export function MissionSetEditorDialog(props: DialogProps) {
    const [editorName, setEditorName] = useState("");
    const [desiredMissionCount, setDesiredMissionCount] = useState(0);
    const [combinedList, setCombinedList] = useState<string[]>([]);
    const [selectedSavedIndex, setSelectedSavedIndex] = useState<number | null>(null);
    const [selectedCombinedIndex, setSelectedCombinedIndex] = useState<number | null>(null);
    const [isWaypointWarningVisible, setIsWaypointWarningVisible] = useState(false);
    const [userHasOverriddenCount, setUserHasOverriddenCount] = useState(false);
    const snapshotCache = useRef<Map<string, MissionSetSnapshot>>(new Map());

    const savedMissionSets = listSavedMissionSets();

    /**
     * Toggles selection of an item in the stored mission sets list.
     * Clicking the already-selected item deselects it.
     *
     * @param {number} index Index of the clicked item in savedMissionSets
     * @returns {void}
     */
    const handleSavedItemClick = (index: number) => {
        setSelectedSavedIndex((prev) => (prev === index ? null : index));
    };

    /**
     * Toggles selection of an item in the combined mission set list.
     * Clicking the already-selected item deselects it.
     *
     * @param {number} index Index of the clicked item in combinedList
     * @returns {void}
     */
    const handleCombinedItemClick = (index: number) => {
        setSelectedCombinedIndex((prev) => (prev === index ? null : index));
    };

    /**
     * Adds the selected stored mission set to the combined list.
     * Inserts before the selected combined list item if one is selected, otherwise appends.
     * Validates the projected waypoint count and shows a warning if MAX_WAYPOINTS would be exceeded.
     * Auto-updates desiredMissionCount to match the added set's mission count when the user
     * has not manually overridden it.
     *
     * @returns {void}
     */
    const handleAdd = () => {
        if (selectedSavedIndex === null) return;
        const selectedSavedName = savedMissionSets[selectedSavedIndex];

        if (!snapshotCache.current.has(selectedSavedName)) {
            snapshotCache.current.set(
                selectedSavedName,
                loadSnapshotFromLocalStorage(selectedSavedName).snapshot!,
            );
        }

        const projectedList =
            selectedCombinedIndex !== null
                ? [
                      ...combinedList.slice(0, selectedCombinedIndex),
                      selectedSavedName,
                      ...combinedList.slice(selectedCombinedIndex),
                  ]
                : [...combinedList, selectedSavedName];

        const addedMissionCount = snapshotCache.current.get(selectedSavedName)!.missions.length;
        // Validate against the count that will actually be used when combining.
        // If the user locked the count, it stays at desiredMissionCount (no auto-update after add).
        // If the user hasn't locked it, the count will be bumped to addedMissionCount when larger.
        const projectedMissionCount = userHasOverriddenCount
            ? desiredMissionCount
            : Math.max(desiredMissionCount, addedMissionCount);

        if (
            getMaxWaypointsPerOutputMission(
                projectedList,
                projectedMissionCount,
                snapshotCache.current,
            ) > MAX_WAYPOINTS
        ) {
            setIsWaypointWarningVisible(true);
            return;
        }

        setCombinedList(projectedList);
        if (selectedCombinedIndex !== null) {
            setSelectedCombinedIndex(selectedCombinedIndex);
        }
        if (!userHasOverriddenCount && addedMissionCount > desiredMissionCount) {
            setDesiredMissionCount(addedMissionCount);
        }
    };

    /**
     * Moves the selected combined list item one position up.
     * No-op if nothing is selected or the item is already at the top.
     *
     * @returns {void}
     */
    const handleMoveUp = () => {
        if (selectedCombinedIndex === null || selectedCombinedIndex === 0) return;
        const next = [...combinedList];
        [next[selectedCombinedIndex - 1], next[selectedCombinedIndex]] = [
            next[selectedCombinedIndex],
            next[selectedCombinedIndex - 1],
        ];
        setCombinedList(next);
        setSelectedCombinedIndex(selectedCombinedIndex - 1);
    };

    /**
     * Moves the selected combined list item one position down.
     * No-op if nothing is selected or the item is already at the bottom.
     *
     * @returns {void}
     */
    const handleMoveDown = () => {
        if (selectedCombinedIndex === null || selectedCombinedIndex === combinedList.length - 1)
            return;
        const next = [...combinedList];
        [next[selectedCombinedIndex], next[selectedCombinedIndex + 1]] = [
            next[selectedCombinedIndex + 1],
            next[selectedCombinedIndex],
        ];
        setCombinedList(next);
        setSelectedCombinedIndex(selectedCombinedIndex + 1);
    };

    /**
     * Removes the selected item from the combined mission set list.
     * Resets desiredMissionCount to the largest remaining set's mission count
     * when the user has not manually overridden it.
     *
     * @returns {void}
     */
    const handleDelete = () => {
        if (selectedCombinedIndex === null) return;
        const remaining = combinedList.filter((_, i) => i !== selectedCombinedIndex);
        setCombinedList(remaining);
        setSelectedCombinedIndex(null);
        if (!userHasOverriddenCount) {
            const maxCount = remaining.reduce((max, name) => {
                const count = snapshotCache.current.get(name)!.missions.length;
                return Math.max(max, count);
            }, 0);
            setDesiredMissionCount(maxCount);
        }
    };

    /**
     * Handles changes to the Number of Bots input field.
     * Validates the projected waypoint count for the new bot count and shows a warning
     * if MAX_WAYPOINTS would be exceeded, leaving the count unchanged in that case.
     *
     * @param {React.ChangeEvent<HTMLInputElement>} evt Change event from the number input
     * @returns {void}
     */
    const handleDesiredMissionCountChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const newCount = Number(evt.target.value);
        if (
            combinedList.length > 0 &&
            newCount > 0 &&
            getMaxWaypointsPerOutputMission(combinedList, newCount, snapshotCache.current) >
                MAX_WAYPOINTS
        ) {
            setIsWaypointWarningVisible(true);
            return;
        }
        setUserHasOverriddenCount(true);
        setDesiredMissionCount(newCount);
    };

    const hasCombinedSelection = selectedCombinedIndex !== null;
    const addButtonLabel = hasCombinedSelection ? "Insert" : "Add";

    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog mission-set-editor">
                    <h1>Mission Set Editor</h1>
                    <div className="editor-top-row">
                        <div className="input-container editor-name-input">
                            <label>New Mission Set Name</label>
                            <input
                                type="text"
                                placeholder="Required"
                                value={editorName}
                                onChange={(evt) => setEditorName(evt.target.value)}
                            />
                        </div>
                        <div className="input-container editor-count-input">
                            <label>Number of Bots</label>
                            <input
                                type="number"
                                min={1}
                                value={formatNumericalInput(desiredMissionCount)}
                                onChange={handleDesiredMissionCountChange}
                            />
                        </div>
                    </div>
                    <div className="editor-lists-section">
                        <div className="editor-list-column">
                            <label>Stored Mission Sets</label>
                            <div className="editor-list-scroll">
                                <ul
                                    className="editor-source-list"
                                    role="listbox"
                                    aria-label="Stored Mission Sets"
                                >
                                    {savedMissionSets.map((name, index) => (
                                        <SavedListItem
                                            key={name}
                                            name={name}
                                            index={index}
                                            isSelected={selectedSavedIndex === index}
                                            onSelect={handleSavedItemClick}
                                        />
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="editor-arrow-column">
                            <Button
                                className="jaia-button editor-add-button"
                                disabled={selectedSavedIndex === null}
                                onClick={handleAdd}
                            >
                                <div className="editor-add-button-content">
                                    <Icon path={mdiArrowRight} size={1} title={addButtonLabel} />
                                    <span>{addButtonLabel}</span>
                                </div>
                            </Button>
                        </div>
                        <div className="editor-list-column">
                            <label>Combined Mission Set</label>
                            <div className="editor-list-scroll">
                                <ul
                                    className="editor-list"
                                    role="listbox"
                                    aria-label="Combined Mission Set"
                                >
                                    {combinedList.map((name, index) => (
                                        <CombinedListItem
                                            key={`${name}-${index}`}
                                            name={name}
                                            index={index}
                                            isSelected={selectedCombinedIndex === index}
                                            onSelect={handleCombinedItemClick}
                                        />
                                    ))}
                                </ul>
                            </div>
                            <div className="editor-controls-row">
                                <Button
                                    className="jaia-button"
                                    disabled={!hasCombinedSelection || selectedCombinedIndex === 0}
                                    onClick={handleMoveUp}
                                >
                                    <Icon path={mdiArrowUp} size={0.8} title="Move up" />
                                </Button>
                                <Button
                                    className="jaia-button"
                                    disabled={
                                        !hasCombinedSelection ||
                                        selectedCombinedIndex === combinedList.length - 1
                                    }
                                    onClick={handleMoveDown}
                                >
                                    <Icon path={mdiArrowDown} size={0.8} title="Move down" />
                                </Button>
                                <Button
                                    className="jaia-button"
                                    disabled={!hasCombinedSelection}
                                    onClick={handleDelete}
                                >
                                    <Icon path={mdiDelete} size={0.8} title="Delete" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    {isWaypointWarningVisible && (
                        <div className="secondary-dialog alert">
                            <h1>Alert</h1>
                            <p>{`Adding this mission set would exceed the maximum of ${MAX_WAYPOINTS} waypoints per mission.`}</p>
                            <button onClick={() => setIsWaypointWarningVisible(false)}>
                                Close
                            </button>
                        </div>
                    )}
                    <div className="editor-button-row">
                        <SaveAndLoadButton
                            editorName={editorName}
                            desiredMissionCount={desiredMissionCount}
                            combinedMissionNames={combinedList}
                            snapshotCache={snapshotCache.current}
                            onClose={props.onClose}
                        />
                        <button onClick={props.onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>,
        document.getElementById(JCC_CONTAINER)!,
    );
}

/**
 * A single selectable item in the stored mission sets list.
 *
 * @param {SavedListItemProps} props.name Display name of the mission set
 * @param {SavedListItemProps} props.index Position in the savedMissionSets array
 * @param {SavedListItemProps} props.isSelected Whether this item is currently selected
 * @param {SavedListItemProps} props.onSelect Callback invoked with the item's index when clicked
 * @returns {JSX.Element} Rendered list item element
 */
function SavedListItem(props: SavedListItemProps) {
    return (
        <li
            className={`editor-source-item${props.isSelected ? " selected" : ""}`}
            role="option"
            aria-selected={props.isSelected}
            onClick={() => props.onSelect(props.index)}
        >
            {props.name}
        </li>
    );
}

/**
 * A single selectable item in the combined mission set list.
 *
 * @param {CombinedListItemProps} props.name Display name of the mission set
 * @param {CombinedListItemProps} props.index Position in the combinedList array
 * @param {CombinedListItemProps} props.isSelected Whether this item is currently selected
 * @param {CombinedListItemProps} props.onSelect Callback invoked with the item's index when clicked
 * @returns {JSX.Element} Rendered list item element
 */
function CombinedListItem(props: CombinedListItemProps) {
    return (
        <li
            className={`editor-list-item${props.isSelected ? " selected" : ""}`}
            role="option"
            aria-selected={props.isSelected}
            onClick={() => props.onSelect(props.index)}
        >
            {props.name}
        </li>
    );
}

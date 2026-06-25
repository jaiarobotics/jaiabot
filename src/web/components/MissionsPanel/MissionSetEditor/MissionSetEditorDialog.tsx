import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@mdi/react";
import { mdiArrowRight, mdiArrowUp, mdiArrowDown, mdiDelete } from "@mdi/js";
import { Button } from "@mui/material";

import { JCC_CONTAINER, MAX_WAYPOINTS } from "../../../utils/constants";
import {
    listSavedMissionSetsFromHub,
    loadSnapshotFromHub,
} from "../MissionSetStorage/mission-set-storage";
import { MissionSetSnapshot } from "../../../data/mission_set/mission-set";
import { getMaxWaypointsPerOutputMission } from "./mission-set-editor";
import SaveAndLoadButton from "./SaveAndLoadButton/SaveAndLoadButton";

import "./MissionSetEditor.less";

interface WaypointWarningProps {
    onClose: () => void;
}

/**
 * Alert overlay shown when adding a mission set would exceed MAX_WAYPOINTS.
 */
function WaypointWarning({ onClose }: WaypointWarningProps) {
    return (
        <div className="secondary-dialog alert">
            <h1>Alert</h1>
            <p>{`Adding this mission set would exceed the maximum of ${MAX_WAYPOINTS} waypoints per mission.`}</p>
            <button onClick={onClose}>Close</button>
        </div>
    );
}

interface DialogProps {
    isVisible: boolean;
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
 * Displays a stored mission sets list and an ordered combination list.
 * Validates waypoint counts before allowing the combined set to be saved and loaded.
 */
export function MissionSetEditorDialog(props: DialogProps) {
    const [editorName, setEditorName] = useState("");
    const [combinedList, setCombinedList] = useState<string[]>([]);
    const [selectedSavedIndex, setSelectedSavedIndex] = useState<number | null>(null);
    const [selectedCombinedIndex, setSelectedCombinedIndex] = useState<number | null>(null);
    const [isWaypointWarningVisible, setIsWaypointWarningVisible] = useState(false);
    const missionSetSnapshotCache = useRef<Map<string, MissionSetSnapshot>>(new Map());
    const [savedMissionSets, setSavedMissionSets] = useState<string[]>([]);

    useEffect(() => {
        if (props.isVisible) {
            listSavedMissionSetsFromHub()
                .then(setSavedMissionSets)
                .catch(() => setSavedMissionSets([]));
        }
    }, [props.isVisible]);

    if (!props.isVisible) {
        return <div></div>;
    }

    /** Toggles selection of a stored mission set item; deselects if already selected.
     *
     * @returns {void}
     */
    const handleSavedItemClick = (index: number) => {
        setSelectedSavedIndex((prev) => (prev === index ? null : index));
    };

    /** Toggles selection of a combined list item; deselects if already selected.
     *
     * @returns {void}
     */
    const handleCombinedItemClick = (index: number) => {
        setSelectedCombinedIndex((prev) => (prev === index ? null : index));
    };

    /** Inserts before the selected combined item, or appends if none selected. Rejects if it would exceed MAX_WAYPOINTS.
     *
     * @returns {void}
     */
    const handleAdd = async () => {
        if (selectedSavedIndex === null) return;
        const selectedSavedName = savedMissionSets[selectedSavedIndex];

        if (!missionSetSnapshotCache.current.has(selectedSavedName)) {
            try {
                const loadResult = await loadSnapshotFromHub(selectedSavedName);
                missionSetSnapshotCache.current.set(selectedSavedName, loadResult.snapshot!);
            } catch (error) {
                console.error(
                    `Failed to load mission set "${selectedSavedName}" from the hub:`,
                    error,
                );
                return;
            }
        }

        let projectedList: string[];
        if (selectedCombinedIndex !== null) {
            projectedList = [
                ...combinedList.slice(0, selectedCombinedIndex),
                selectedSavedName,
                ...combinedList.slice(selectedCombinedIndex),
            ];
        } else {
            projectedList = [...combinedList, selectedSavedName];
        }

        if (
            getMaxWaypointsPerOutputMission(projectedList, missionSetSnapshotCache.current) >
            MAX_WAYPOINTS
        ) {
            setIsWaypointWarningVisible(true);
            return;
        }

        setCombinedList(projectedList);
    };

    /** Moves the selected combined list item one position up.
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

    /** Moves the selected combined list item one position down.
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

    /** Removes the selected item from the combined list.
     *
     * @returns {void}
     */
    const handleDelete = () => {
        if (selectedCombinedIndex === null) return;
        const remaining = combinedList.filter((_, i) => i !== selectedCombinedIndex);
        setCombinedList(remaining);
        setSelectedCombinedIndex(null);
    };

    const hasCombinedSelection = selectedCombinedIndex !== null;
    const addButtonLabel = hasCombinedSelection ? "Insert" : "Add";

    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog mission-set-editor">
                    <h1>Mission Set Editor</h1>
                    <div className="editor-name-input">
                        <label>New Mission Set Name</label>
                        <input
                            type="text"
                            placeholder="Required"
                            value={editorName}
                            onChange={(evt) => setEditorName(evt.target.value)}
                        />
                    </div>
                    <div className="editor-lists-section">
                        <div className="editor-list">
                            <label>Stored Mission Sets</label>
                            <ul role="listbox" aria-label="Stored Mission Sets">
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
                        <button
                            className="add-button"
                            disabled={selectedSavedIndex === null}
                            onClick={handleAdd}
                        >
                            <Icon path={mdiArrowRight} size={1} title={addButtonLabel} />
                            <div>{addButtonLabel}</div>
                        </button>
                        <div className="editor-list">
                            <label>Combined Mission Set</label>
                            <ul role="listbox" aria-label="Combined Mission Set">
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
                        <div className="editor-controls">
                            <button
                                disabled={!hasCombinedSelection || selectedCombinedIndex === 0}
                                onClick={handleMoveUp}
                            >
                                <Icon path={mdiArrowUp} size={0.8} title="Move up" />
                            </button>
                            <button
                                disabled={
                                    !hasCombinedSelection ||
                                    selectedCombinedIndex === combinedList.length - 1
                                }
                                onClick={handleMoveDown}
                            >
                                <Icon path={mdiArrowDown} size={0.8} title="Move down" />
                            </button>
                            <button disabled={!hasCombinedSelection} onClick={handleDelete}>
                                <Icon path={mdiDelete} size={0.8} title="Delete" />
                            </button>
                        </div>
                    </div>
                    {isWaypointWarningVisible && (
                        <WaypointWarning onClose={() => setIsWaypointWarningVisible(false)} />
                    )}
                    <div className="editor-button-row">
                        <SaveAndLoadButton
                            editorName={editorName}
                            combinedMissionNames={combinedList}
                            missionSetSnapshotCache={missionSetSnapshotCache.current}
                            savedNames={savedMissionSets}
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
 * Selectable item in the stored mission sets list.
 */
function SavedListItem(props: SavedListItemProps) {
    return (
        <li
            className={props.isSelected ? "selected" : ""}
            role="option"
            aria-selected={props.isSelected}
            onClick={() => props.onSelect(props.index)}
        >
            {props.name}
        </li>
    );
}

/**
 * Selectable item in the combined mission set list.
 */
function CombinedListItem(props: CombinedListItemProps) {
    return (
        <li
            className={props.isSelected ? " selected" : ""}
            role="option"
            aria-selected={props.isSelected}
            onClick={() => props.onSelect(props.index)}
        >
            {props.name}
        </li>
    );
}

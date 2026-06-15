import { useMemo, useRef, useState } from "react";
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
    const savedMissionSets = useMemo(() => listSavedMissionSets(), [props.isVisible]);

    if (!props.isVisible) {
        return <div></div>;
    }

    const handleSavedItemClick = (index: number) => {
        setSelectedSavedIndex((prev) => (prev === index ? null : index));
    };

    const handleCombinedItemClick = (index: number) => {
        setSelectedCombinedIndex((prev) => (prev === index ? null : index));
    };

    // Inserts before the selected combined item if one is selected, otherwise appends. Rejects if it would exceed MAX_WAYPOINTS.
    const handleAdd = () => {
        if (selectedSavedIndex === null) return;
        const selectedSavedName = savedMissionSets[selectedSavedIndex];

        if (!missionSetSnapshotCache.current.has(selectedSavedName)) {
            missionSetSnapshotCache.current.set(
                selectedSavedName,
                loadSnapshotFromLocalStorage(selectedSavedName).snapshot!,
            );
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

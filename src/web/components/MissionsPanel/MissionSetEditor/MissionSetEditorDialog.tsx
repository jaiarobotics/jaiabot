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

interface LeftListItemProps {
    name: string;
    index: number;
    isSelected: boolean;
    onSelect: (index: number) => void;
}

interface RightListItemProps {
    name: string;
    index: number;
    isSelected: boolean;
    onSelect: (index: number) => void;
}

export function MissionSetEditorDialog(props: DialogProps) {
    const [editorName, setEditorName] = useState("");
    const [desiredMissionCount, setDesiredMissionCount] = useState(0);
    const [rightList, setRightList] = useState<string[]>([]);
    const [selectedLeftIndex, setSelectedLeftIndex] = useState<number | null>(null);
    const [selectedRightIndex, setSelectedRightIndex] = useState<number | null>(null);
    const [isWaypointWarningVisible, setIsWaypointWarningVisible] = useState(false);
    const [userHasOverriddenCount, setUserHasOverriddenCount] = useState(false);
    const snapshotCache = useRef<Map<string, MissionSetSnapshot>>(new Map());

    const savedMissionSets = listSavedMissionSets();

    const handleLeftItemClick = (index: number) => {
        setSelectedLeftIndex((prev) => (prev === index ? null : index));
    };

    const handleRightItemClick = (index: number) => {
        setSelectedRightIndex((prev) => (prev === index ? null : index));
    };

    const handleAdd = () => {
        if (selectedLeftIndex === null) return;
        const selectedLeftName = savedMissionSets[selectedLeftIndex];

        if (!snapshotCache.current.has(selectedLeftName)) {
            snapshotCache.current.set(
                selectedLeftName,
                loadSnapshotFromLocalStorage(selectedLeftName).snapshot!,
            );
        }

        const projectedList =
            selectedRightIndex !== null
                ? [
                      ...rightList.slice(0, selectedRightIndex),
                      selectedLeftName,
                      ...rightList.slice(selectedRightIndex),
                  ]
                : [...rightList, selectedLeftName];

        const addedMissionCount = snapshotCache.current.get(selectedLeftName)!.missions.length;
        const projectedMissionCount = Math.max(desiredMissionCount, addedMissionCount);

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

        setRightList(projectedList);
        if (selectedRightIndex !== null) {
            setSelectedRightIndex(selectedRightIndex);
        }
        if (!userHasOverriddenCount && addedMissionCount > desiredMissionCount) {
            setDesiredMissionCount(addedMissionCount);
        }
    };

    const handleMoveUp = () => {
        if (selectedRightIndex === null || selectedRightIndex === 0) return;
        const next = [...rightList];
        [next[selectedRightIndex - 1], next[selectedRightIndex]] = [
            next[selectedRightIndex],
            next[selectedRightIndex - 1],
        ];
        setRightList(next);
        setSelectedRightIndex(selectedRightIndex - 1);
    };

    const handleMoveDown = () => {
        if (selectedRightIndex === null || selectedRightIndex === rightList.length - 1) return;
        const next = [...rightList];
        [next[selectedRightIndex], next[selectedRightIndex + 1]] = [
            next[selectedRightIndex + 1],
            next[selectedRightIndex],
        ];
        setRightList(next);
        setSelectedRightIndex(selectedRightIndex + 1);
    };

    const handleDelete = () => {
        if (selectedRightIndex === null) return;
        const remaining = rightList.filter((_, i) => i !== selectedRightIndex);
        setRightList(remaining);
        setSelectedRightIndex(null);
        if (!userHasOverriddenCount) {
            const maxCount = remaining.reduce((max, name) => {
                const count = snapshotCache.current.get(name)!.missions.length;
                return Math.max(max, count);
            }, 0);
            setDesiredMissionCount(maxCount);
        }
    };

    const handleDesiredMissionCountChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const newCount = Number(evt.target.value);
        if (
            rightList.length > 0 &&
            newCount > 0 &&
            getMaxWaypointsPerOutputMission(rightList, newCount, snapshotCache.current) >
                MAX_WAYPOINTS
        ) {
            setIsWaypointWarningVisible(true);
            return;
        }
        setUserHasOverriddenCount(true);
        setDesiredMissionCount(newCount);
    };

    const hasRightSelection = selectedRightIndex !== null;
    const addButtonLabel = hasRightSelection ? "Insert" : "Add";

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
                                        <LeftListItem
                                            key={name}
                                            name={name}
                                            index={index}
                                            isSelected={selectedLeftIndex === index}
                                            onSelect={handleLeftItemClick}
                                        />
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="editor-arrow-column">
                            <Button
                                className="jaia-button editor-add-button"
                                disabled={selectedLeftIndex === null}
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
                                    {rightList.map((name, index) => (
                                        <RightListItem
                                            key={`${name}-${index}`}
                                            name={name}
                                            index={index}
                                            isSelected={selectedRightIndex === index}
                                            onSelect={handleRightItemClick}
                                        />
                                    ))}
                                </ul>
                            </div>
                            <div className="editor-controls-row">
                                <Button
                                    className="jaia-button"
                                    disabled={!hasRightSelection || selectedRightIndex === 0}
                                    onClick={handleMoveUp}
                                >
                                    <Icon path={mdiArrowUp} size={0.8} title="Move up" />
                                </Button>
                                <Button
                                    className="jaia-button"
                                    disabled={
                                        !hasRightSelection ||
                                        selectedRightIndex === rightList.length - 1
                                    }
                                    onClick={handleMoveDown}
                                >
                                    <Icon path={mdiArrowDown} size={0.8} title="Move down" />
                                </Button>
                                <Button
                                    className="jaia-button"
                                    disabled={!hasRightSelection}
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
                            combinedMissionNames={rightList}
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

function LeftListItem(props: LeftListItemProps) {
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

function RightListItem(props: RightListItemProps) {
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

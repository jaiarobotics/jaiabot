import { useState } from "react";
import { createPortal } from "react-dom";

import { JCC_CONTAINER } from "../../../utils/constants";
import { listSavedMissionSets } from "./mission-set-storage";
import SaveMissionSetButton from "./SaveMissionSetButton/SaveMissionSetButton";
import LoadMissionSetButton from "./LoadMissionSetButton/LoadMissionSetButton";
import DeleteMissionSetButton from "./DeleteMissionSetButton/DeleteMissionSetButton";
import ImportMissionSetButton from "./ImportMissionSetButton/ImportMissionSetButton";
import ExportMissionSetButton from "./ExportMissionSetButton/ExportMissionSetButton";

import "./MissionSetStorage.less";

interface DialogProps {
    missionSetName: string;
    onClose: () => void;
}

interface MissionSetRowProps {
    name: string;
    saveName: string;
    onClick: (name: string) => void;
}

/**
 * Produces the dialog box that appears when clicking on the load/save mission set button
 * This dialog provides delete, save and load mission set buttons
 */
export function MissionSetStorageDialog(props: DialogProps) {
    const [saveName, setSaveName] = useState(props.missionSetName);

    /**
     * Updates the selected mission set in state
     *
     * @param {string} name Mission set name clicked
     * @returns {void}
     */
    const handleMissionSetClick = (name: string) => {
        setSaveName(name);
    };

    /**
     * Updates the selected mission set text after mission set deletion
     *
     * @returns {void}
     */
    const clearSaveName = () => {
        setSaveName("");
    };

    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog mission-set-storage">
                    <h1>Mission Set Storage</h1>
                    <div className="input-container">
                        <label>Mission Set Name</label>
                        <input
                            type="text"
                            value={saveName}
                            onChange={(evt) => {
                                setSaveName(evt.target.value);
                            }}
                        />
                    </div>
                    <div className="mission-sets-container">
                        <label>Stored Mission Sets</label>
                        <ul className="mission-set-names">
                            {listSavedMissionSets().map((name) => {
                                return (
                                    <MissionSetRow
                                        name={name}
                                        saveName={saveName}
                                        onClick={handleMissionSetClick}
                                        key={name}
                                    />
                                );
                            })}
                        </ul>
                    </div>
                    <div className="button-row">
                        <DeleteMissionSetButton saveName={saveName} clearSaveName={clearSaveName} />
                        <SaveMissionSetButton saveName={saveName} />
                        <LoadMissionSetButton saveName={saveName} onClose={props.onClose} />
                    </div>
                    <div className="line-break"></div>
                    <div className="button-row">
                        <ExportMissionSetButton saveName={saveName} />
                        <ImportMissionSetButton onClose={props.onClose} />
                    </div>
                    <button onClick={props.onClose}>Close</button>
                </div>
            </div>
        </div>,
        document.getElementById(JCC_CONTAINER),
    );
}

/**
 * Produces a clickable list item for each mission set in local storage
 */
function MissionSetRow(props: MissionSetRowProps) {
    /**
     * Provides the class name to produce the correct style
     *
     * @returns {string} Class name that will apply correct style
     */
    const getClassName = () => {
        let className = "mission-set-row";
        if (props.name === props.saveName) {
            className += " selected";
        }
        return className;
    };

    return (
        <li className={getClassName()} onClick={() => props.onClick(props.name)}>
            {props.name}
        </li>
    );
}

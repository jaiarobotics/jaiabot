import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import { JCC_CONTAINER } from "../../../utils/constants";
import { listSavedZoneSetsFromHub } from "./zone-storage";
import SaveZoneButton from "./SaveZoneButton/SaveZoneButton";
import LoadZoneButton from "./LoadZoneButton/LoadZoneButton";
import DeleteZoneButton from "./DeleteZoneButton/DeleteZoneButton";
import ExportZoneButton from "./ExportZoneButton/ExportZoneButton";
import ImportZoneButton from "./ImportZoneButton/ImportZoneButton";

import "../../MissionsPanel/MissionSetStorage/MissionSetStorage.less";

interface DialogProps {
    zoneSetName: string;
    onClose: () => void;
}

interface ZoneSetRowProps {
    name: string;
    saveName: string;
    onClick: (name: string) => void;
}

/**
 * Produces the dialog box that appears when clicking on the zone storage button.
 * This dialog provides delete, save, load, export, and import zone set buttons.
 */
export function ZoneStorageDialog(props: DialogProps) {
    const [saveName, setSaveName] = useState(props.zoneSetName);
    const [savedNames, setSavedNames] = useState<string[]>([]);

    /**
     * Fetches the list of saved zone set names from the Hub and updates state.
     *
     * @returns {void}.
     */
    const refreshNames = () => {
        listSavedZoneSetsFromHub()
            .then(setSavedNames)
            .catch(() => setSavedNames([]));
    };

    useEffect(() => {
        refreshNames();
    }, []);

    /**
     * Updates the selected zone set in state.
     *
     * @param {string} name Zone set name clicked.
     * @returns {void}.
     */
    const handleZoneSetClick = (name: string) => {
        setSaveName(name);
    };

    /**
     * Updates the selected zone set text after zone set deletion.
     *
     * @returns {void}.
     */
    const clearSaveName = () => {
        setSaveName("");
    };

    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog set-storage">
                    <h1>Obstacle Zone Storage</h1>
                    <div className="input-container">
                        <label>Zone Set Name</label>
                        <input
                            type="text"
                            value={saveName}
                            onChange={(evt) => setSaveName(evt.target.value)}
                        />
                    </div>
                    <div className="stored-sets-container">
                        <label>Stored Zone Sets</label>
                        <ul className="stored-set-names">
                            {savedNames.map((name) => (
                                <ZoneSetRow
                                    key={name}
                                    name={name}
                                    saveName={saveName}
                                    onClick={handleZoneSetClick}
                                />
                            ))}
                        </ul>
                    </div>
                    <div className="button-row">
                        <DeleteZoneButton
                            saveName={saveName}
                            savedNames={savedNames}
                            clearSaveName={clearSaveName}
                            onDeleted={refreshNames}
                        />
                        <SaveZoneButton
                            saveName={saveName}
                            savedNames={savedNames}
                            onSaved={refreshNames}
                        />
                        <LoadZoneButton
                            saveName={saveName}
                            savedNames={savedNames}
                            onClose={props.onClose}
                        />
                    </div>
                    <div className="line-break"></div>
                    <div className="button-row">
                        <ExportZoneButton saveName={saveName} />
                        <ImportZoneButton onClose={props.onClose} />
                    </div>
                    <button onClick={props.onClose}>Close</button>
                </div>
            </div>
        </div>,
        document.getElementById(JCC_CONTAINER),
    );
}

/**
 * Produces a clickable list item for each zone set stored on the Hub.
 */
function ZoneSetRow(props: ZoneSetRowProps) {
    /**
     * Provides the class name to produce the correct style.
     *
     * @returns {string} Class name that will apply correct style.
     */
    const getClassName = () => {
        let className = "stored-set-row";
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

import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@mui/material";
import Icon from "@mdi/react";
import { mdiFolder } from "@mdi/js";

import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { JCC_CONTAINER, MDI_BUTTON_SIZE } from "../../../utils/constants";
import {
    saveToLocalStorage,
    loadSnapshotFromLocalStorage,
    deleteFromLocalStorage,
    listSavedZoneSets,
    exportZonesToFile,
    importZonesFromFile,
} from "./zone-storage";

import "../../MissionsPanel/MissionSetStorage/MissionSetStorage.less";

export default function ZoneStorageButton() {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    return (
        <div>
            <Button
                className="jaia-button"
                aria-label="zone-storage"
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiFolder} size={MDI_BUTTON_SIZE} title="Obstacle Zone Storage" />
            </Button>
            {isDialogVisible && <ZoneStorageDialog onClose={() => setIsDialogVisible(false)} />}
        </div>
    );
}

interface DialogProps {
    onClose: () => void;
}

function ZoneStorageDialog(props: DialogProps) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [saveName, setSaveName] = useState("");
    const [savedNames, setSavedNames] = useState(() => listSavedZoneSets());

    const refreshNames = () => setSavedNames(listSavedZoneSets());

    const handleSave = () => {
        if (!saveName.trim()) return;
        saveToLocalStorage(saveName.trim());
        refreshNames();
    };

    const handleLoad = () => {
        if (!saveName.trim()) return;
        const snapshot = loadSnapshotFromLocalStorage(saveName.trim());
        if (snapshot) {
            jaiaDispatch({
                type: JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
                exclusionZoneSnapshot: snapshot,
            });
            props.onClose();
        }
    };

    const handleDelete = () => {
        if (!saveName.trim()) return;
        deleteFromLocalStorage(saveName.trim());
        setSaveName("");
        refreshNames();
    };

    const handleExport = () => {
        exportZonesToFile(saveName || "obstacle-zones");
    };

    const handleImport = async () => {
        const snapshot = await importZonesFromFile();
        if (snapshot) {
            jaiaDispatch({
                type: JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
                exclusionZoneSnapshot: snapshot,
            });
            props.onClose();
        }
    };

    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay">
                <div className="jaia-dialog mission-set-storage">
                    <h1>Obstacle Zone Storage</h1>
                    <div className="input-container">
                        <label>Zone Set Name</label>
                        <input
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                        />
                    </div>
                    <div className="mission-sets-container">
                        <label>Stored Zone Sets</label>
                        <ul className="mission-set-names">
                            {savedNames.map((name) => (
                                <li
                                    key={name}
                                    className={
                                        "mission-set-row" + (name === saveName ? " selected" : "")
                                    }
                                    onClick={() => setSaveName(name)}
                                >
                                    {name}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="button-row">
                        <button onClick={handleDelete} disabled={!saveName.trim()}>
                            Delete
                        </button>
                        <button onClick={handleSave} disabled={!saveName.trim()}>
                            Save
                        </button>
                        <button onClick={handleLoad} disabled={!saveName.trim()}>
                            Load
                        </button>
                    </div>
                    <div className="line-break"></div>
                    <div className="button-row">
                        <button onClick={handleExport}>Export</button>
                        <button onClick={handleImport}>Import</button>
                    </div>
                    <button onClick={props.onClose}>Close</button>
                </div>
            </div>
        </div>,
        document.getElementById(JCC_CONTAINER),
    );
}

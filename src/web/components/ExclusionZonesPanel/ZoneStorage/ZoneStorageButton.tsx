import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@mui/material";
import Icon from "@mdi/react";
import { mdiFolder } from "@mdi/js";

import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { DialogActions } from "../../../types/context-types";
import { JCC_CONTAINER, MDI_BUTTON_SIZE } from "../../../utils/constants";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import {
    saveToHub,
    loadSnapshotFromHub,
    deleteFromHub,
    listSavedZoneSetsFromHub,
    exportZonesToFile,
    importZonesFromFile,
    ImportZoneResultType,
} from "./zone-storage";

import "../../MissionsPanel/MissionSetStorage/MissionSetStorage.less";

interface ZoneStorageButtonProps {
    zoneSetName: string;
}

export default function ZoneStorageButton({ zoneSetName }: ZoneStorageButtonProps) {
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
            {isDialogVisible && (
                <ZoneStorageDialog
                    zoneSetName={zoneSetName}
                    onClose={() => setIsDialogVisible(false)}
                />
            )}
        </div>
    );
}

// Mirrors the secondary-dialog states across Save / Load / Delete / Export / Import
type SecondaryDialogType =
    | "save-overwrite" // confirm overwrite of existing name
    | "save-no-zones" // alert: no zones to save
    | "save-no-name" // alert: name field is empty
    | "confirm-load" // confirm clear-and-load
    | "load-not-found" // alert: name not in storage
    | "confirm-delete" // confirm deletion
    | "delete-not-found" // alert: name not in storage
    | "export-no-zones" // alert: no zones to export
    | "export-no-name" // alert: name field is empty
    | "confirm-import" // confirm clear-and-import
    | "import-invalid" // alert: bad file format
    | "load-no-name" // alert: name field is empty
    | "delete-no-name" // alert: name field is empty
    | null;

interface SecondaryContent {
    title: string;
    message: string;
    isConfirm: boolean;
    confirmLabel?: string;
}

interface DialogProps {
    zoneSetName: string;
    onClose: () => void;
}

function ZoneStorageDialog(props: DialogProps) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [saveName, setSaveName] = useState(props.zoneSetName);
    const [savedNames, setSavedNames] = useState<string[]>([]);
    const [secondaryDialog, setSecondaryDialog] = useState<SecondaryDialogType>(null);

    const refreshNames = () => {
        listSavedZoneSetsFromHub()
            .then(setSavedNames)
            .catch(() => setSavedNames([]));
    };

    // Load names from hub when dialog opens
    useEffect(() => {
        refreshNames();
    }, []);

    const hasZones = exclusionZoneSet.getZones().size > 0;

    // ── Save ────────────────────────────────────────────────────────────────

    const handleSave = () => {
        if (!hasZones) {
            setSecondaryDialog("save-no-zones");
            return;
        }
        if (!saveName.trim()) {
            setSecondaryDialog("save-no-name");
            return;
        }
        if (savedNames.includes(saveName.trim())) {
            setSecondaryDialog("save-overwrite");
            return;
        }
        // No conflicts — save directly
        saveToHub(saveName.trim()).then(() => {
            jaiaDispatch({
                type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
                exclusionZoneSetName: saveName.trim(),
            });
            refreshNames();
        });
    };

    // ── Load ────────────────────────────────────────────────────────────────

    const handleLoad = () => {
        if (!saveName.trim()) {
            setSecondaryDialog("load-no-name");
            return;
        }
        setSecondaryDialog("confirm-load");
    };

    // ── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = () => {
        if (!saveName.trim()) {
            setSecondaryDialog("delete-no-name");
            return;
        }
        setSecondaryDialog("confirm-delete");
    };

    // ── Export ──────────────────────────────────────────────────────────────

    const handleExport = () => {
        if (!hasZones) {
            setSecondaryDialog("export-no-zones");
            return;
        }
        if (!saveName.trim()) {
            setSecondaryDialog("export-no-name");
            return;
        }
        exportZonesToFile(saveName.trim());
    };

    // ── Import ──────────────────────────────────────────────────────────────

    const handleImport = () => {
        setSecondaryDialog("confirm-import");
    };

    // ── Secondary dialog close handler ──────────────────────────────────────

    const onSecondaryClose = async (dialogAction: DialogActions) => {
        const current = secondaryDialog;
        setSecondaryDialog(null);

        if (dialogAction !== DialogActions.CONFIRMED) return;

        switch (current) {
            case "save-overwrite":
                saveToHub(saveName.trim()).then(() => {
                    jaiaDispatch({
                        type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
                        exclusionZoneSetName: saveName.trim(),
                    });
                    refreshNames();
                });
                break;

            case "confirm-load": {
                if (!savedNames.includes(saveName.trim())) {
                    setSecondaryDialog("load-not-found");
                    return;
                }
                loadSnapshotFromHub(saveName.trim()).then((snapshot) => {
                    if (snapshot) {
                        jaiaDispatch({
                            type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
                            exclusionZoneSetName: saveName.trim(),
                        });
                        jaiaDispatch({
                            type: JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
                            exclusionZoneSnapshot: snapshot,
                        });
                        props.onClose();
                    } else {
                        setSecondaryDialog("load-not-found");
                    }
                });
                break;
            }

            case "confirm-delete":
                if (!savedNames.includes(saveName.trim())) {
                    setSecondaryDialog("delete-not-found");
                    return;
                }
                deleteFromHub(saveName.trim()).then(() => {
                    setSaveName("");
                    refreshNames();
                });
                break;

            case "confirm-import": {
                const result = await importZonesFromFile();
                if (result.resultType === ImportZoneResultType.SUCCESS && result.snapshot) {
                    jaiaDispatch({
                        type: JaiaActions.RESTORE_EXCLUSION_ZONE_SNAPSHOT,
                        exclusionZoneSnapshot: result.snapshot,
                    });
                    props.onClose();
                } else if (result.resultType === ImportZoneResultType.INVALID_FORMAT) {
                    setSecondaryDialog("import-invalid");
                }
                // CANCELLED: user closed the file picker, do nothing
                break;
            }
        }
    };

    // ── Secondary dialog content ─────────────────────────────────────────────

    const getSecondaryContent = (): SecondaryContent | null => {
        switch (secondaryDialog) {
            case "save-overwrite":
                return {
                    title: "Confirm",
                    message: `Replace the zone set named: ${saveName.trim()}`,
                    isConfirm: true,
                    confirmLabel: "Save",
                };
            case "save-no-zones":
                return {
                    title: "Alert",
                    message: "Please create an obstacle zone before saving.",
                    isConfirm: false,
                };
            case "save-no-name":
                return {
                    title: "Alert",
                    message: "Please name the zone set before saving.",
                    isConfirm: false,
                };
            case "confirm-load":
                return {
                    title: "Confirm",
                    message: "The obstacle zone panel will be cleared prior to loading.",
                    isConfirm: true,
                    confirmLabel: "Load",
                };
            case "load-not-found":
                return {
                    title: "Alert",
                    message: `There is no zone set with name: ${saveName.trim()}`,
                    isConfirm: false,
                };
            case "confirm-delete":
                return {
                    title: "Confirm",
                    message: `Delete the zone set named: ${saveName.trim()}`,
                    isConfirm: true,
                    confirmLabel: "Delete",
                };
            case "delete-not-found":
                return {
                    title: "Alert",
                    message: `There is no zone set with name: ${saveName.trim()}`,
                    isConfirm: false,
                };
            case "export-no-zones":
                return {
                    title: "Alert",
                    message: "Please create an obstacle zone before exporting.",
                    isConfirm: false,
                };
            case "export-no-name":
                return {
                    title: "Alert",
                    message: "Please name the zone set before exporting.",
                    isConfirm: false,
                };
            case "confirm-import":
                return {
                    title: "Confirm",
                    message: "The obstacle zone panel will be cleared prior to importing.",
                    isConfirm: true,
                    confirmLabel: "Import",
                };
            case "import-invalid":
                return {
                    title: "Warning",
                    message: "The file could not be imported, it is an invalid format.",
                    isConfirm: false,
                };
            case "load-no-name":
                return {
                    title: "Alert",
                    message: "Please enter or select a zone set name before loading.",
                    isConfirm: false,
                };
            case "delete-no-name":
                return {
                    title: "Alert",
                    message: "Please enter or select a zone set name before deleting.",
                    isConfirm: false,
                };
            default:
                return null;
        }
    };

    const secondary = getSecondaryContent();

    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay">
                <div className="jaia-dialog set-storage">
                    <h1>Obstacle Zone Storage</h1>
                    <div className="input-container">
                        <label>Zone Set Name</label>
                        <input
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                        />
                    </div>
                    <div className="stored-sets-container">
                        <label>Stored Zone Sets</label>
                        <ul className="stored-set-names">
                            {savedNames.map((name) => (
                                <li
                                    key={name}
                                    className={
                                        "stored-set-row" + (name === saveName ? " selected" : "")
                                    }
                                    onClick={() => setSaveName(name)}
                                >
                                    {name}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="button-row">
                        <button onClick={handleDelete}>Delete</button>
                        <button onClick={handleSave}>Save</button>
                        <button onClick={handleLoad}>Load</button>
                        {secondary && (
                            <div
                                className={`secondary-dialog ${secondary.isConfirm ? "" : "alert"}`}
                            >
                                <h1>{secondary.title}</h1>
                                <p>{secondary.message}</p>
                                {secondary.isConfirm ? (
                                    <div className="dialog-button-row">
                                        <button
                                            className="dialog-button"
                                            onClick={() => onSecondaryClose(DialogActions.NONE)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="dialog-button"
                                            onClick={() =>
                                                onSecondaryClose(DialogActions.CONFIRMED)
                                            }
                                        >
                                            {secondary.confirmLabel}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="dialog-button-row">
                                        <button
                                            className="dialog-button"
                                            onClick={() => onSecondaryClose(DialogActions.NONE)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
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

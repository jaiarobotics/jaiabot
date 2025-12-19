import { DialogActions } from "../../../../types/context-types";

export enum DialogWarningType {
    CLEAR_MISSIONS,
    OLD_FORMAT,
    INVALID_FORMAT,
}

interface DialogProps {
    isVisible: boolean;
    onClose: (dialogAction: DialogActions) => void;
    warningType: DialogWarningType;
}

interface ButtonRowProps {
    onClose: (dialogAction: DialogActions) => void;
    commit: boolean; // true = confirm dialog, false = informational
}

const isConfirmDialog = (type: DialogWarningType) => {
    return type === DialogWarningType.CLEAR_MISSIONS;
};

const getDialogWarningText = (type: DialogWarningType) => {
    switch (type) {
        case DialogWarningType.CLEAR_MISSIONS:
            return "The mission set panel will be cleared prior to importing.";
        case DialogWarningType.OLD_FORMAT:
            return "The imported file is an old format.  Export the mission set to translate it to the new format.";
        case DialogWarningType.INVALID_FORMAT:
            return "The file could not be imported, it is an invalid format.";
    }
};

/**
 * Produces the seconday dialog box for warnings based on warning type
 * DialogWarningType.CLEAR_MISSIONS: Warns user the current misison set will be overwritten
 *      Buttons will be Cancel & Confirm
 * DialogWarningType.OLD_FORMAT: Notifies user the file is old format and suggests re-exporting
 *      Button will be Close
 * DialogWarningType.INVALID_FORMAT: Notifies user the file was invalid
 *      Button will be Close
 */
export function ImportMissionSetDialog(props: DialogProps) {
    if (!props.isVisible) {
        return <div></div>;
    }
    const commit = isConfirmDialog(props.warningType);
    const title = commit ? "Confirm" : "Warning";

    return (
        <div className="secondary-dialog alert">
            <h1>{title}</h1>
            <p>{getDialogWarningText(props.warningType)}</p>
            <ButtonRow onClose={props.onClose} commit={commit} />
        </div>
    );
}

/**
 * Produces the buttons for the dialog box.
 * The buttons will be Cancel and Import if it is a commit dialog or
 * Close if it is not
 */
function ButtonRow(props: ButtonRowProps) {
    if (props.commit) {
        // Confirm dialog: Cancel + Import
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Cancel
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    Import
                </button>
            </div>
        );
    } else {
        // Informational dialog: single Close button
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
            </div>
        );
    }
}

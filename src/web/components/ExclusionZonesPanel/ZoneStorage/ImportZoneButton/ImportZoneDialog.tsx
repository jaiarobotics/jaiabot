import { DialogActions } from "../../../../types/context-types";

export enum DialogWarningType {
    CLEAR_ZONES,
    INVALID_FORMAT,
}

interface DialogProps {
    isVisible: boolean;
    warningType: DialogWarningType;
    onClose: (dialogAction: DialogActions) => void;
}

interface ButtonRowProps {
    onClose: (dialogAction: DialogActions) => void;
    isConfirm: boolean;
}

/**
 * Produces the secondary dialog box for warnings when importing a zone set.
 */
export function ImportZoneDialog(props: DialogProps) {
    /**
     * Distinguishes dialog types (confirmation vs informative).
     *
     * @param {DialogWarningType} type Warning type to be displayed.
     * @returns {boolean}.
     */
    const isConfirmDialog = (type: DialogWarningType) => {
        return type === DialogWarningType.CLEAR_ZONES;
    };

    /**
     * Provides the text to display in the dialog.
     *
     * @param {DialogWarningType} type Determines which message to display.
     * @returns {string} Text to display in the dialog.
     */
    const getDialogWarningText = (type: DialogWarningType) => {
        switch (type) {
            case DialogWarningType.CLEAR_ZONES:
                return "The obstacle zone panel will be cleared prior to importing.";
            case DialogWarningType.INVALID_FORMAT:
                return "The file could not be imported, it is an invalid format.";
        }
    };

    const isConfirm = isConfirmDialog(props.warningType);
    const title = isConfirm ? "Confirm" : "Warning";

    if (!props.isVisible) {
        return;
    }

    return (
        <div className="secondary-dialog alert">
            <h1>{title}</h1>
            <p>{getDialogWarningText(props.warningType)}</p>
            <ButtonRow onClose={props.onClose} isConfirm={isConfirm} />
        </div>
    );
}

/**
 * Produces the buttons for the dialog box.
 * The buttons will be Cancel and Import if it is a confirmation dialog,
 * or Close if it is an informative dialog.
 */
function ButtonRow(props: ButtonRowProps) {
    if (props.isConfirm) {
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
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
            </div>
        );
    }
}

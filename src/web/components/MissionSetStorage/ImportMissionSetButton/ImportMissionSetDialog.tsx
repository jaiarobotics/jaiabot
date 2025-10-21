import { DialogActions } from "../../../types/context-types";

interface DialogProps {
    isVisible: boolean;
    onClose: (dialogAction: DialogActions) => void;
}

interface ButtonRowProps {
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the dialog box that appears when clicking on the import mission set button.
 * This dialog will be an alert
 */
export function ImportMissionSetDialog(props: DialogProps) {
    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="secondary-dialog alert">
            <h1>Confirm</h1>
            <p>The mission set panel will be cleared prior to importing.</p>
            <ButtonRow onClose={props.onClose} />
        </div>
    );
}

/**
 * Produces the buttons for the dialog box.
 * The buttons will be Cancel and Import.
 */
function ButtonRow(props: ButtonRowProps) {
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
}

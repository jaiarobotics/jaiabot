import { DialogActions } from "../../../../types/context-types";
import { DisabledCodes, messages } from "./save-and-load-messages";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
    editorName: string;
    onClose: (dialogAction: DialogActions) => void;
}

interface ButtonRowProps {
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Confirmation or alert dialog for the Save and Load action.
 * Shows an alert if prerequisites are not met; shows a confirm/cancel prompt otherwise.
 * @param {DialogProps} props.isVisible Controls whether the dialog is rendered
 * @param {DialogProps} props.disabledCode Indicates why the action is blocked, or NONE if it is allowed
 * @param {DialogProps} props.editorName Name of the new mission set, appended to the confirm message
 * @param {DialogProps} props.onClose Callback invoked with the user's choice when the dialog closes
 * @returns {JSX.Element} Alert or confirmation dialog
 */
export function SaveAndLoadDialog(props: DialogProps) {
    if (!props.isVisible) {
        return <div></div>;
    }

    const isAlert =
        props.disabledCode !== DisabledCodes.NONE && props.disabledCode !== DisabledCodes.OVERWRITE;

    const getDialogMessage = () => {
        if (
            props.disabledCode === DisabledCodes.NONE ||
            props.disabledCode === DisabledCodes.OVERWRITE
        ) {
            return messages.get(props.disabledCode) + props.editorName;
        }
        return messages.get(props.disabledCode);
    };

    return (
        <div className={`secondary-dialog${isAlert ? " alert" : ""}`}>
            <h1>{isAlert ? "Alert" : "Confirm"}</h1>
            <p>{getDialogMessage()}</p>
            <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
        </div>
    );
}

/**
 * Renders a Close button for alert dialogs, or Cancel and Save and Load buttons for confirm dialogs.
 * @param {ButtonRowProps} props.disabledCode Determines whether to render the alert or confirm button layout
 * @param {ButtonRowProps} props.onClose Callback invoked with the user's choice
 * @returns {JSX.Element} Row of action buttons appropriate for the dialog state
 */
function ButtonRow(props: ButtonRowProps) {
    const isAlert =
        props.disabledCode !== DisabledCodes.NONE && props.disabledCode !== DisabledCodes.OVERWRITE;

    if (isAlert) {
        return <button onClick={() => props.onClose(DialogActions.NONE)}>Close</button>;
    }

    return (
        <div className="dialog-button-row">
            <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                Cancel
            </button>
            <button
                className="dialog-button"
                onClick={() => props.onClose(DialogActions.CONFIRMED)}
            >
                Save and Load
            </button>
        </div>
    );
}

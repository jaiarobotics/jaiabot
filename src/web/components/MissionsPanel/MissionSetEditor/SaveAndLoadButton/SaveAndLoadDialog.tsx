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

export function SaveAndLoadDialog(props: DialogProps) {
    if (!props.isVisible) {
        return <div></div>;
    }

    const isAlert =
        props.disabledCode !== DisabledCodes.NONE && props.disabledCode !== DisabledCodes.OVERWRITE;

    const getDialogMessage = () => {
        if (props.disabledCode === DisabledCodes.NONE) {
            return `Save and load the combined mission set "${props.editorName}"?`;
        }
        if (props.disabledCode === DisabledCodes.OVERWRITE) {
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

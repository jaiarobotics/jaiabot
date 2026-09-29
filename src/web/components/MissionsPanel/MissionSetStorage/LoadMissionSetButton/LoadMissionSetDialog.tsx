import { DisabledCodes, messages } from "./load-messages";
import { DialogActions } from "../../../../types/context-types";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
    saveName: string;
    onClose: (dialogAction: DialogActions) => void;
}

interface TitleProps {
    disabledCode: DisabledCodes;
}

interface ButtonRowProps {
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the dialog box that appears when clicking on the load mission set button.
 * This dialog will be an alert
 */
export function LoadMissionSetDialog(props: DialogProps) {
    /**
     * Forms the class name with a base of "jaia-dialog" and adds
     * "alert" when the disabled code does not equal NONE.
     *
     * @returns {string} General class name jaia-dialog plus confirm/alert type
     */
    const getClassName = () => {
        return `secondary-dialog ${props.disabledCode !== DisabledCodes.NONE ? "alert" : ""}`;
    };

    /**
     * Adjusts the text in the dialog based on the disabled code
     *
     * @returns {string} The text to be displayed in the dialog
     */
    const getDialogMessage = () => {
        if (props.disabledCode === DisabledCodes.FILE_NOT_FOUND) {
            return messages.get(props.disabledCode) + props.saveName;
        }
        return messages.get(props.disabledCode);
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className={getClassName()}>
            <Title disabledCode={props.disabledCode} />
            <p>{getDialogMessage()}</p>
            <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
        </div>
    );
}

/**
 * Produces the title for the dialog box. If there are no error conditions the title
 * will be Confirm, otherwise it will be Alert.
 */
function Title(props: TitleProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

/**
 * Produces the buttons for the dialog box.
 * For a confirmation dialog, the buttons will be Cancel and Save.
 * For an alert, the button will be Close.
 */
function ButtonRow(props: ButtonRowProps) {
    switch (props.disabledCode) {
        case DisabledCodes.NONE: {
            return (
                <div className="dialog-button-row">
                    <button
                        className="dialog-button"
                        onClick={() => props.onClose(DialogActions.NONE)}
                    >
                        Cancel
                    </button>
                    <button
                        className="dialog-button"
                        onClick={() => props.onClose(DialogActions.CONFIRMED)}
                    >
                        Load
                    </button>
                </div>
            );
        }
        case DisabledCodes.FILE_NOT_FOUND:
        case DisabledCodes.OLD_FORMAT: {
            return (
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
            );
        }
    }
}

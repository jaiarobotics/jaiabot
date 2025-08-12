import { DisabledCodes, messages } from "./load-messages";
import { DialogActions } from "../../../types/context-types";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
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
        return `jaia-dialog ${props.disabledCode !== DisabledCodes.NONE ? "alert" : ""}`;
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className={getClassName()}>
                    <Title disabledCode={props.disabledCode} />
                    <p>{messages.get(props.disabledCode)}</p>
                    <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
                </div>
            </div>
        </div>
    );
}

/**
 * Produces the title for the dialog box. If there are no error conditions the title
 * will be Confirm, otherwise it will be Alert.
 */
function Title(props: TitleProps) {
    if (props.disabledCode === DisabledCodes.CONFIRM) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

/**
 * Produces the buttons for the dialox box.
 * For a confirmation dialog, the buttons will be Cancel and Save.
 * For an alert, the button will be Close.
 */
function ButtonRow(props: ButtonRowProps) {
    switch (props.disabledCode) {
        case DisabledCodes.NONE:
        case DisabledCodes.CONFIRM: {
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
        case DisabledCodes.FILE_NOT_FOUND: {
            return (
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
            );
        }
    }
}

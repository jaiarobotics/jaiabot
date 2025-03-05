import { DisabledCodes, messages } from "./activate-messages";

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

export enum DialogActions {
    NONE = 0,
    CONFIRMED = 1,
}

/**
 * Produces the dialog box that appears when clicking on the actdivate button.
 * This dialog will be an alert if the command cannot be
 * sent or a confirmation prior to sending the command.
 */
export function ActivateDialog(props: DialogProps) {
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
        <div>
            <div className="blocking-overlay" onClick={() => {}}></div>
            <div className={getClassName()}>
                <Title disabledCode={props.disabledCode} />
                <p>{messages.get(props.disabledCode)}</p>
                <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
            </div>
        </div>
    );
}

/**
 * Produces the title for the dialog box. If there is nothing blocking the command from
 * being sent the title will be Confirm, otherwise it will be Alert.
 */
function Title(props: TitleProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

/**
 * Produces the buttons for the dialox box.
 * For a confirmation dialog, the buttons will be Cancel and Confirm.
 * For an alert, the button will be Stop.
 */
function ButtonRow(props: ButtonRowProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Cancel
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    Stop
                </button>
            </div>
        );
    }

    return (
        <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
            Close
        </button>
    );
}

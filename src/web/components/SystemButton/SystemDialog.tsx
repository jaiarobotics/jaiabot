import { SystemButtonTypes } from "../../types/jaia-system-types";
import { DisabledCodes } from "./system-messages";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
    systemButton: SystemButtonTypes;
}

interface TitleProps {
    disabledCode: DisabledCodes;
}

interface ButtonRowProps {
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
    systemButton: SystemButtonTypes;
}

export enum DialogActions {
    NONE = 0,
    CONFIRMED = 1,
}

/**
 * Produces the dialog box that appears when clicking one of the system buttons.
 * This dialog will be an alert if the command cannot be
 * sent or a confirmation prior to sending the command.
 */
export function SystemDialog(props: DialogProps) {
    /**
     * Forms the class name with a base of "jaia-dialog" and adds
     * "alert" when the disabled code does not equal NONE.
     *
     * @returns {string} General class name jaia-dialog plus confirm/alert type
     */
    const getClassName = () => {
        return `jaia-dialog ${props.disabledCode !== DisabledCodes.NONE ? "alert" : ""}`;
    };

    /**
     * Creates the alert message for each system button type
     *
     * @returns {string} Alert message when the button is not available
     */
    const generateAlertMessage = () => {
        if (props.disabledCode === DisabledCodes.NONE) {
            return "";
        }
        //TODO need to customize message based on node
        const endMsg = "command cannot be sent because the Bot needs to be stopped.";
        switch (props.systemButton) {
            case SystemButtonTypes.SHUTDOWN:
                return "The shutdown " + endMsg;
            case SystemButtonTypes.REBOOT:
                return "The reboot " + endMsg;
            case SystemButtonTypes.RESTART_SERVICES:
                return "The restart services " + endMsg;
        }
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div>
            <div className="blocking-overlay" onClick={() => {}}>
                <div className={getClassName()}>
                    <Title disabledCode={props.disabledCode} />
                    <p>{generateAlertMessage()}</p>
                    <ButtonRow
                        disabledCode={props.disabledCode}
                        onClose={props.onClose}
                        systemButton={props.systemButton}
                    />
                </div>
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
 * For a confirmation dialog, the buttons will be Cancel and [Shutdown, Reboot, Restart Services].
 * For an alert, the button will be Close.
 */
function ButtonRow(props: ButtonRowProps) {
    const getButtonText = () => {
        switch (props.systemButton) {
            case SystemButtonTypes.SHUTDOWN:
                return "Shutdown";
            case SystemButtonTypes.REBOOT:
                return "Reboot";
            case SystemButtonTypes.RESTART_SERVICES:
                return "Restart Services";
        }
    };

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
                    {getButtonText()}
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

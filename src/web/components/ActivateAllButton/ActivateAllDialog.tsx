interface DialogProps {
    isVisible: boolean;
    availableBotIDs: number[];
    activatedBotIDs: number[];
    noCommsBotIDs: number[];
    onClose: (dialogAction: DialogActions) => void;
}

interface TitleProps {
    availableBotIDs: number[];
}

interface ButtonRowProps {
    availableBotIDs: number[];
    onClose: (dialogAction: DialogActions) => void;
}

enum TextTypes {
    AVAILABLE = 0,
    ACTIVATED = 1,
    NO_COMMS = 2,
}

export enum DialogActions {
    NONE = 0,
    CONFIRMED = 1,
}

/**
 * Produces the dialog box that appears when clicking on the activate all button.
 * This dialog will be a confirmation if at least one Bot can accept the command.
 * It will describe the reason(s) the other Bots cannot accept the command.
 */
export function ActivateAllDialog(props: DialogProps) {
    /**
     * Applies the base class "jaia-dialog" and appends "alert"
     * if no Bots are in a state to receive the command
     *
     * @returns {string} The class name for the dialog div
     */
    const getClassName = () => {
        return `jaia-dialog ${props.availableBotIDs.length === 0 ? "alert" : ""}`;
    };

    /**
     * Places each message to be displayed in the dialox box in an array.
     * The messages depend on the state of the Bot and the requirments of the command.
     *
     * @returns {string[]} The messages to be displayed in the dialog box
     */
    const generateMessage = () => {
        return [
            generateSubMessage(props.availableBotIDs, TextTypes.AVAILABLE),
            generateSubMessage(props.activatedBotIDs, TextTypes.ACTIVATED),
            generateSubMessage(props.noCommsBotIDs, TextTypes.NO_COMMS),
        ];
    };

    /**
     * Produces the messages that appear in the dialog box. These messages describe
     * which Bot(s) can accept the command and which Bot(s) cannot.
     *
     * @param {number[]} botIDs Bots that fall into the condition of the textType
     * @param {TextTypes} textType Describes the relationship of Bots to the command
     * @returns {string} Sub message to display to an operator in the dialog box
     */
    const generateSubMessage = (botIDs: number[], textType: TextTypes) => {
        if (botIDs.length === 0) {
            return "";
        }

        let subMessage = "";

        // Message start
        if (textType === TextTypes.AVAILABLE) {
            subMessage += `Send command to Bot${botIDs.length > 1 ? "s: " : ": "}`;
        } else {
            subMessage += `Cannot send command to Bot${botIDs.length > 1 ? "s: " : ": "}`;
        }

        // Adding Bot IDs to message
        for (let i = 0; i < botIDs.length; i++) {
            if (i + 1 < botIDs.length) {
                subMessage += botIDs[i] + ", ";
            } else {
                subMessage += botIDs[i] + " ";
            }
        }

        // Message end
        if (textType === TextTypes.ACTIVATED) {
            subMessage += `because ${botIDs.length > 1 ? "they are activated." : "it is activated."}`;
        } else if (textType === TextTypes.NO_COMMS) {
            subMessage += `because ${botIDs.length > 1 ? "they do not have comms with the Hub." : "it does not have comms with the Hub."}`;
        }

        return subMessage;
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}></div>
            <div className={getClassName()}>
                <Title availableBotIDs={props.availableBotIDs} />
                {generateMessage().map((subMessage, index) => {
                    return <p key={index}>{subMessage}</p>;
                })}
                <ButtonRow availableBotIDs={props.availableBotIDs} onClose={props.onClose} />
            </div>
        </div>
    );
}

/**
 * Produces the title for the dialog box. If there is nothing blocking the command from
 * being sent to at least one Bot the title will be Confirm, otherwise it will be Alert.
 */
function Title(props: TitleProps) {
    if (props.availableBotIDs.length > 0) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

/**
 * Produces the buttons for the dialox box.
 * For a confirmation dialog, the buttons will be Cancel and Confirm.
 * For an alert, the button will be Activate.
 */
function ButtonRow(props: ButtonRowProps) {
    if (props.availableBotIDs.length > 0) {
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Cancel
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    Activate
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

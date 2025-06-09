import { DisabledCodes } from "../ActivateButton/activate-messages";

interface DialogProps {
    isVisible: boolean;
    botReadyStates: Map<DisabledCodes, number[]>;
    numBots: number;
    onClose: (dialogAction: DialogActions) => void;
}

interface TitleProps {
    botReadyStates: Map<DisabledCodes, number[]>;
}

interface ButtonRowProps {
    botReadyStates: Map<DisabledCodes, number[]>;
    onClose: (dialogAction: DialogActions) => void;
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
     * if at least one Bot cannot receive the command
     *
     * @returns {string} The class name for the dialog div
     */
    const getClassName = () => {
        return `jaia-dialog ${props.botReadyStates.get(DisabledCodes.NONE).length !== props.numBots ? "alert" : ""}`;
    };

    /**
     * Places each sub message to be displayed in the dialox box in an array.
     * The messages depend on the state of the Bot and the requirments of the command.
     *
     * @returns {string[]} The messages to be displayed in the dialog box
     */
    const generateMessage = () => {
        const message: string[] = [];

        // Halve the length to only count the names
        const disabledCodesLength = Object.keys(DisabledCodes).length / 2;

        for (let i = 1; i <= disabledCodesLength; i++) {
            message.push(generateSubMessage(i));
        }

        return message;
    };

    /**
     * Produces the messages that appear in the dialog box. These messages describe
     * which Bot(s) can accept the command and which Bot(s) cannot.
     *
     * @returns {string} Sub message to display to an operator in the dialog box
     */
    const generateSubMessage = (disabledCode: DisabledCodes) => {
        const botIDs = props.botReadyStates.get(disabledCode);

        if (botIDs.length === 0) {
            return "";
        }

        let subMessage = "";

        // Message start
        if (disabledCode === DisabledCodes.NONE) {
            subMessage += `Activate Bot${botIDs.length > 1 ? "s: " : ": "}`;
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
        switch (disabledCode) {
            case DisabledCodes.NO_COMMS:
                subMessage += `because ${botIDs.length > 1 ? "they do not have comms with the Hub." : "it does not have comms with the Hub."}`;
                break;
            case DisabledCodes.MISSION_STATE:
                subMessage += `because ${botIDs.length > 1 ? "they are activated." : "it is activated."}`;
                break;
        }

        return subMessage;
    };

    /**
     * Converts the message into an array of paragraph elements for React to render
     *
     * @returns {JSX.Element[]} Paragraph elements containing alert messages
     */
    const formatMessage = () => {
        return generateMessage().map((subMessage, index) => {
            if (subMessage !== "") {
                return <p key={index}>{subMessage}</p>;
            }
        });
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}></div>
            <div className={getClassName()}>
                <Title botReadyStates={props.botReadyStates} />
                {formatMessage()}
                <ButtonRow botReadyStates={props.botReadyStates} onClose={props.onClose} />
            </div>
        </div>
    );
}

/**
 * Produces the title for the dialog box. If there is nothing blocking the command from
 * being sent to at least one Bot the title will be Confirm, otherwise it will be Alert.
 */
function Title(props: TitleProps) {
    if (props.botReadyStates.get(DisabledCodes.NONE).length > 0) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

/**
 * Produces the buttons for the dialox box.
 * For a confirmation dialog, the buttons will be Cancel and Activate Bot(s).
 * For an alert, the button will be Close.
 */
function ButtonRow(props: ButtonRowProps) {
    const numReadyBots = props.botReadyStates.get(DisabledCodes.NONE).length;
    if (numReadyBots > 0) {
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Cancel
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    {`${numReadyBots > 1 ? "Activate Bots" : "Activate Bot"}`}
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

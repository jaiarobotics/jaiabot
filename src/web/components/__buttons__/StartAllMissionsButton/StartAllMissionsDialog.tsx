import { DisabledCodes } from "../disabled-codes";
import { DialogActions } from "../../../types/context-types";

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

/**
 * Produces the dialog box that appears when clicking on the start all missions button.
 * This dialog will be a confirmation if at least one Bot can accept the command.
 * It will describe the reason(s) the other Bots cannot accept the command.
 */
export function StartAllMissionsDialog(props: DialogProps) {
    const numReadyBots = props.botReadyStates.get(DisabledCodes.NONE).length;

    /**
     * Applies the base class "jaia-dialog" and appends "alert"
     * if at least one Bot cannot receive the command to adjust spacing
     *
     * @returns {string} The class name for the dialog div
     */
    const getClassName = () => {
        return `jaia-dialog ${numReadyBots !== props.numBots ? "alert" : ""}`;
    };

    /**
     * Places each sub message to be displayed in the dialog box in an array.
     * The messages depend on the state of the Bot and the requirements of the command.
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

        if (!botIDs || botIDs.length === 0) {
            return "";
        }

        let subMessage = "";

        // Message start
        if (disabledCode === DisabledCodes.NONE) {
            subMessage += `Send mission${botIDs.length > 1 ? "s" : ""} to Bot${botIDs.length > 1 ? "s: " : ": "}`;
        } else {
            subMessage += `Cannot send mission${botIDs.length > 1 ? "s" : ""} to Bot${botIDs.length > 1 ? "s: " : ": "}`;
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
                subMessage += `because ${botIDs.length > 1 ? "they need to be activated to receive a mission." : "it needs to be activated to receive a mission."}`;
                break;
            case DisabledCodes.NO_MISSION:
                subMessage += `because ${botIDs.length > 1 ? "they do not have an assigned mission." : "it does not have an assigned mission."}`;
                break;
            case DisabledCodes.DOWNLOAD_QUEUE:
                subMessage += `because ${botIDs.length > 1 ? "they are in the download queue." : "it is in the download queue."}`;
                break;
            case DisabledCodes.LOW_BATTERY:
                subMessage += `because ${botIDs.length > 1 ? "they have a critically low battery." : "it has a critically low battery."}`;
                break;
            case DisabledCodes.INSUFFICIENT_BATTERY:
                subMessage += `because ${botIDs.length > 1 ? "their batteries are predicted to fall below the safe minimum after the mission." : "its battery is predicted to fall below the safe minimum after the mission."}`;
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
                <ButtonRow
                    botReadyStates={props.botReadyStates}
                    onClose={(dialogAction) => props.onClose(dialogAction)}
                />
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
 * For a confirmation dialog, the buttons will be Cancel and Start Missions.
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
                    {`${numReadyBots > 1 ? "Start Missions" : "Start Mission"}`}
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

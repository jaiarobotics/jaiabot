interface DialogProps {
    isVisible: boolean;
    availableBotIDs: number[];
    activatedBotIDs: number[];
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
}

export enum DialogActions {
    NONE = 0,
    CONFIRMED = 1,
}

export function ActivateAllDialog(props: DialogProps) {
    const getClassName = () => {
        return `jaia-dialog ${props.availableBotIDs.length === 0 ? "alert" : ""}`;
    };

    const generateMessage = () => {
        return [
            generateSubMessage(props.availableBotIDs, TextTypes.AVAILABLE),
            generateSubMessage(props.activatedBotIDs, TextTypes.ACTIVATED),
        ];
    };

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
                subMessage += botIDs[i];
            }
        }

        // Message end
        if (textType === TextTypes.ACTIVATED) {
            subMessage += `because ${botIDs.length > 1 ? "they are activated" : "it is activated"}`;
        }

        return subMessage;
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div>
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

function Title(props: TitleProps) {
    if (props.availableBotIDs.length > 0) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

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
}

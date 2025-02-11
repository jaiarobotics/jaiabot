import { DialogActions } from "../DataOffloadButton/DataOffloadButton";
import { DisabledCodes } from "../DataOffloadButton/DataOffloadButton";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

interface TitleMessageProps {
    disabledCode: DisabledCodes;
}

interface ButtonRowProps {
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

export default function DataOffloadDialog(props: DialogProps) {
    if (props.isVisible) {
        return (
            <div className="jaia-dialog">
                <Title disabledCode={props.disabledCode} />
                <Message disabledCode={props.disabledCode} />
                <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
            </div>
        );
    }

    return <div></div>;
}

function Title(props: TitleMessageProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

function Message(props: TitleMessageProps) {
    const messages = new Map<DisabledCodes, string>();

    messages.set(DisabledCodes.NONE, "");
    messages.set(
        DisabledCodes.MISSION_STATE,
        "Cannot start a data offload because the Bot is not in an idle state. Try sending the stop command first.",
    );
    messages.set(
        DisabledCodes.WIFI_QUALITY,
        "The Bot is not connected to the Hub Wi-Fi. Try moving the Bot closer to the Hub.",
    );
    messages.set(DisabledCodes.DOWNLOAD_QUEUE, "The Bot is already in the download queue.");

    return <p>{messages.get(props.disabledCode)}</p>;
}

function ButtonRow(props: ButtonRowProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return (
            <div className="dialog-button-row">
                <button onClick={() => props.onClose(DialogActions.NONE)}>Cancel</button>
                <button onClick={() => props.onClose(DialogActions.CONFIRMED)}>
                    Start Data Offload
                </button>
            </div>
        );
    }

    return <button onClick={() => props.onClose(DialogActions.NONE)}>Close</button>;
}

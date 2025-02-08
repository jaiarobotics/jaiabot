import { DialogActions } from "../DataOffloadButton/DataOffloadButton";
import { DisabledCodes } from "../DataOffloadButton/DataOffloadButton";

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

export default function DataOffloadDialog(props: DialogProps) {
    const messages = new Map<DisabledCodes, string>();
    messages.set(DisabledCodes.NONE, "");
    messages.set(
        DisabledCodes.MISSION_STATE,
        "Cannot start a data offload because the Bot is not in an idle state. Try sending the stop command first.",
    );
    messages.set(
        DisabledCodes.WIFI_QUALITY,
        "The Bot does not have a strong enough Wi-Fi connection to start a data offload. Try moving the Bot closer to the Hub.",
    );
    messages.set(DisabledCodes.DOWNLOAD_QUEUE, "The Bot is already in the download queue.");

    if (props.isVisible) {
        return (
            <div className="jaia-dialog">
                <Title disabledCode={props.disabledCode} />
                <p>{messages.get(props.disabledCode)}</p>
                <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
            </div>
        );
    }

    return <div></div>;
}

function Title(props: TitleProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
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

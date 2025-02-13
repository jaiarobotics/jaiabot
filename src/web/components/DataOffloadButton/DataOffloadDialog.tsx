import { DisabledCodes } from "./data-offload-messages";
import { messages } from "./data-offload-messages";

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

export function DataOffloadDialog(props: DialogProps) {
    /**
     * Forms the class name with a base of "jaia-dialog" and adds "alert" when the disabled code does not equal NONE.
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
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Cancel
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    Start Data Offload
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

import { DialogActions } from "../../../types/context-types";

interface DialogProps {
    isVisible: boolean;
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the warning dialog that appears when enabling Overdrive in remote control mode.
 */
export function OverdriveWarningDialog(props: DialogProps) {
    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog alert">
                    <h1>Warning</h1>
                    <p>Overdrive offers more speed, but it can make control more difficult.</p>
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
                            Enable Overdrive
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { DialogActions } from "../../types/context-types";
import { jaiaAPI } from "../../utils/jaia-api";

interface Props {
    isVisible: boolean;
    onClose?: (dialogAction: DialogActions) => void;
}

/**
 * Produces the take control dialog box. This will appear when an operator
 * not in control attempts to send a command.
 */
export default function TakeControlDialog(props: Props) {
    /**
     * Makes the call pass the client ID to the server to take control
     *
     * @returns {void}
     */
    const handleTakeControlClick = () => {
        jaiaAPI.takeControl();
        props.onClose(DialogActions.CONFIRMED);
    };

    if (props.isVisible) {
        return (
            <div className="jaia-dialog-container">
                <div className="blocking-overlay" onClick={() => {}}>
                    <div className="jaia-dialog alert">
                        <h1>Confirm</h1>
                        <p>Prior to sending a command, you must be the operator in control.</p>
                        <div className="dialog-button-row">
                            <button
                                className="dialog-button"
                                onClick={() => props.onClose(DialogActions.NONE)}
                            >
                                Cancel
                            </button>
                            <button
                                className="dialog-button"
                                onClick={() => handleTakeControlClick()}
                            >
                                Take Control
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

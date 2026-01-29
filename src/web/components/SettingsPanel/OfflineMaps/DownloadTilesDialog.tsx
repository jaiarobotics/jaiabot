import { DialogActions } from "../../../types/context-types";

interface DialogProps {
    isVisible: boolean;
    estimatedSize: string;
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the dialog box that appears when clicking on the Save Map to Hub arrow.
 */
export function DownloadTilesDialog(props: DialogProps) {
    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog">
                    <h1>Confirm</h1>
                    <p>Approximate download size: {props.estimatedSize}</p>
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
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

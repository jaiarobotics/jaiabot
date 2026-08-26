import React from "react";
import { DisabledCodes, messages } from "./export-messages";
import { DialogActions } from "../../../../types/context-types";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

interface ButtonRowProps {
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the dialog box that appears when clicking on the export zone set button.
 * This dialog will be an alert if the zone set cannot be exported.
 */
export function ExportZoneDialog(props: DialogProps) {
    /**
     * Forms the class name with a base of "secondary-dialog" and adds
     * "alert" when the disabled code does not equal NONE.
     *
     * @returns {string} General class name secondary-dialog plus confirm/alert type.
     */
    const getClassName = () => {
        return `secondary-dialog ${props.disabledCode !== DisabledCodes.NONE ? "alert" : ""}`;
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className={getClassName()}>
            <h1>Alert</h1>
            <p>{messages.get(props.disabledCode)}</p>
            <ButtonRow disabledCode={props.disabledCode} onClose={props.onClose} />
        </div>
    );
}

/**
 * Produces the buttons for the dialog box.
 * For a confirmation dialog, the buttons will be Cancel and Export.
 * For an alert, the button will be Close.
 */
function ButtonRow(props: ButtonRowProps) {
    /**
     * Exits full screen so it can be re-established after the export
     * and passes the confirm signal to the onClose method.
     *
     * @returns {void}.
     */
    const handleExportClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        props.onClose(DialogActions.CONFIRMED);
    };

    switch (props.disabledCode) {
        case DisabledCodes.NONE: {
            return (
                <div className="dialog-button-row">
                    <button
                        className="dialog-button"
                        onClick={() => props.onClose(DialogActions.NONE)}
                    >
                        Cancel
                    </button>
                    <button className="dialog-button" onClick={(event) => handleExportClick(event)}>
                        Export
                    </button>
                </div>
            );
        }
        case DisabledCodes.NO_ZONES:
        case DisabledCodes.NO_NAME: {
            return (
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
            );
        }
    }
}

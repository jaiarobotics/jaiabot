import { messages } from "./start-mission-messages";
import { DisabledCodes } from "../disabled-codes";
import { DialogActions } from "../../../types/context-types";
import {
    BatteryPrediction,
    clampBatteryPercentForDisplay,
    clampDrainPercentForDisplay,
    MAX_DISPLAYED_DRAIN_PERCENT,
} from "../../../data/battery_predictions/battery-prediction-calculator";

interface DialogProps {
    isVisible: boolean;
    disabledCode: DisabledCodes;
    batteryPrediction: BatteryPrediction | null;
    onClose: (dialogAction: DialogActions) => void;
}

interface TitleProps {
    disabledCode: DisabledCodes;
}

interface ButtonRowProps {
    disabledCode: DisabledCodes;
    onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the dialog box that appears when clicking on the start mission button.
 * This dialog will be an alert if the command cannot be
 * sent or a confirmation prior to sending the command.
 */
export function StartMissionDialog(props: DialogProps) {
    /**
     * Forms the class name with a base of "jaia-dialog" and adds
     * "alert" when the disabled code does not equal NONE.
     *
     * @returns {string} General class name jaia-dialog plus confirm/alert type
     */
    const getClassName = () => {
        return `jaia-dialog ${props.disabledCode === DisabledCodes.NONE ? "" : "alert"}`;
    };

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}></div>
            <div className={getClassName()}>
                <Title disabledCode={props.disabledCode} />
                <p>{messages.get(props.disabledCode)}</p>
                {props.batteryPrediction && (
                    <p>
                        Predicted battery after mission:{" "}
                        <strong>
                            {clampBatteryPercentForDisplay(
                                props.batteryPrediction.predicted_final_pct,
                            ).toFixed(1)}
                            %
                        </strong>{" "}
                        (drain:{" "}
                        {props.batteryPrediction.predicted_drain_pct > MAX_DISPLAYED_DRAIN_PERCENT
                            ? ">"
                            : ""}
                        {clampDrainPercentForDisplay(
                            props.batteryPrediction.predicted_drain_pct,
                        ).toFixed(1)}
                        %)
                    </p>
                )}
                <ButtonRow
                    disabledCode={props.disabledCode}
                    onClose={(dialogAction: DialogActions) => {
                        props.onClose(dialogAction);
                    }}
                />
            </div>
        </div>
    );
}

/**
 * Produces the title for the dialog box. If there is nothing blocking the command from
 * being sent the title will be Confirm, otherwise it will be Alert.
 */
function Title(props: TitleProps) {
    if (props.disabledCode === DisabledCodes.NONE) {
        return <h1>Confirm</h1>;
    }

    return <h1>Alert</h1>;
}

/**
 * Produces the buttons for the dialox box.
 * For a confirmation dialog, the buttons will be Cancel and Start Mission.
 * For an alert, the button will be Close.
 */
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
                    Start Mission
                </button>
            </div>
        );
    }

    // Override insufficient battery prediction warning
    if (props.disabledCode === DisabledCodes.INSUFFICIENT_BATTERY) {
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    Override
                </button>
            </div>
        );
    }

    // Override low battery alert
    if (props.disabledCode === DisabledCodes.LOW_BATTERY) {
        return (
            <div className="dialog-button-row">
                <button className="dialog-button" onClick={() => props.onClose(DialogActions.NONE)}>
                    Close
                </button>
                <button
                    className="dialog-button"
                    onClick={() => props.onClose(DialogActions.CONFIRMED)}
                >
                    Override
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

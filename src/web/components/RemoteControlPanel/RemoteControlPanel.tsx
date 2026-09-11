import { useState, useEffect } from "react";
import { mdiChevronDown, mdiChevronUp } from "@mdi/js";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import Icon from "@mdi/react";
import Gamepad from "react-gamepad";

import JaiaToggle from "../JaiaToggle/JaiaToggle";
import { AnalogStick, AnalogStickTypes } from "./AnalogStick/AnalogStick";
import { SelectMenu, ControlTypes } from "./SelectMenu/SelectMenu";
import { Dashboard } from "./Dashboard/Dashboard";
import { DiveCommand, DiveInputs, RCDiveParameters } from "./DiveControls/DiveControls";
import { OverdriveWarningDialog } from "./OverdriveWarning/OverdriveWarningDialog";

import { Engineering } from "../../shared/proto/jaiabot/messages/engineering";
import { Command_CommandType } from "../../shared/proto/jaiabot/messages/jaia_dccl";
import {
    MissionTask_DiveParameters,
    MissionTask_DriftParameters,
    MissionTask_TaskType,
} from "../../shared/proto/jaiabot/messages/mission";
import { sendBotCommand, sendEngineeringCommand } from "../../utils/commands";
import { error, success } from "../../utils/notifications";
import { DialogActions } from "../../types/context-types";
import { SelectChangeEvent } from "@mui/material";

import "./RemoteControlPanel.less";

interface RemoteControlPanelProps {
    botID: number;
}

enum RCZones {
    DEAD = 10,
    LOW = 50,
    HIGH = 95,
}

const throttlePercentages = new Map<number, number>([
    [-1, -10],
    [0, 0],
    [1, 37.5],
    [2, 40],
    [3, 60],
]);

const rudderPercentages = new Map<number, number>([
    [0, 0],
    [1, 40],
    [2, 70],
    [3, 100],
]);

const RC_COMMAND_TIMEOUT = 500; // milliseconds

/**
 * Creates panel to manually control a Bot
 */
export default function RemoteControlPanel(props: RemoteControlPanelProps) {
    const defaultParams = jaiaGlobal.getDefaultTaskParameters();

    const [controlType, setControlType] = useState(ControlTypes.DUAL);
    const [throttleDirection, setThrottleDirection] = useState("");
    const [rudderDirection, setRudderDirection] = useState("");
    const [throttleMagnitude, setThrottleMagnitude] = useState(0);
    const [rudderMagnitude, setRudderMagnitude] = useState(0);
    const [rcDiveParameters, setRCDiveParameters] = useState<RCDiveParameters>({
        ...defaultParams.dive,
        ...defaultParams.drift,
    });
    const [rcOverdrive, setRCOverdrive] = useState(false);
    const [isOverdriveDialogVisible, setIsOverdriveDialogVisible] = useState(false);
    const [isMinimizedView, setIsMinimizedView] = useState(false);

    // Include useEffect dependencies to prevent interval data from going stale
    useEffect(() => {
        const rcCommandInterval = setInterval(() => {
            handleRCInterval();
        }, RC_COMMAND_TIMEOUT);

        return () => {
            clearInterval(rcCommandInterval);
        };
    }, [controlType, throttleDirection, throttleMagnitude, rudderDirection, rudderMagnitude]);

    /**
     * Sends RC commands periodically unless in dive mode.
     *
     * @returns {void}
     */
    const handleRCInterval = () => {
        if (controlType !== ControlTypes.DIVE) {
            sendEngineeringCommand(packageCommand());
        }
    };

    /**
     * Handles axis input from both analog sticks and gamepad
     *
     * @param {number} value Raw axis value (-1 to 1)
     * @param {AnalogStickTypes} axisType Which axis (LEFT for throttle, RIGHT for rudder)
     * @returns {void}
     */
    const handleAxisInput = (value: number, axisType: AnalogStickTypes) => {
        const absValue = Math.abs(value) * 100;

        if (absValue > RCZones.DEAD) {
            // Set direction
            if (axisType === AnalogStickTypes.LEFT) {
                setThrottleDirection(value > 0 ? "FORWARD" : "BACKWARD");
            } else if (axisType === AnalogStickTypes.RIGHT) {
                setRudderDirection(value > 0 ? "RIGHT" : "LEFT");
            }

            // Set magnitude
            let magnitude = 0;
            if (absValue < RCZones.LOW) {
                magnitude = 1;
            } else if (absValue >= RCZones.LOW && absValue <= RCZones.HIGH) {
                magnitude = 2;
            } else {
                magnitude = 3;
                if (axisType === AnalogStickTypes.LEFT && !rcOverdrive) {
                    magnitude = 2;
                }
            }

            // Only one speed in reverse for throttle
            if (value < 0 && axisType === AnalogStickTypes.LEFT) {
                magnitude = 1;
            }

            if (axisType === AnalogStickTypes.LEFT) {
                setThrottleMagnitude(magnitude);
            } else if (axisType === AnalogStickTypes.RIGHT) {
                setRudderMagnitude(magnitude);
            }
        } else {
            // Reset when in dead zone
            if (axisType === AnalogStickTypes.LEFT) {
                setThrottleDirection("");
                setThrottleMagnitude(0);
            } else if (axisType === AnalogStickTypes.RIGHT) {
                setRudderDirection("");
                setRudderMagnitude(0);
            }
        }
    };

    /**
     * Updates state with the selected analog stick layout (single vs dual)
     *
     * @param {SelectChangeEvent} event Contains the selected menu item
     * @returns {void}
     */
    const handleMenuSelection = (event: SelectChangeEvent) => {
        setControlType(event.target.value as ControlTypes);
    };

    /**
     * Updates the toggle state to adapt the speed settings
     *
     * @returns {void}
     */
    const handleOverdriveToggleClick = () => {
        if (rcOverdrive) {
            setRCOverdrive(false);
        } else {
            setIsOverdriveDialogVisible(true);
        }
    };

    /**
     * Closes the overdrive warning dialog and enables overdrive if confirmed
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onOverdriveDialogClose = (dialogAction: DialogActions) => {
        setIsOverdriveDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            setRCOverdrive(true);
        }
    };

    /**
     * Resets the throttle and rudder when the analog stick is released
     *
     * @returns {void}
     */
    const onAnalogStickStop = () => {
        setThrottleDirection("");
        setThrottleMagnitude(0);
        setRudderDirection("");
        setRudderMagnitude(0);
    };

    /**
     * Adds the throttle and rudder data to the Engineering command message
     *
     * @returns {Engineering} Throttle and rudder values to send to Bot
     */
    const packageCommand = () => {
        let throttle = throttlePercentages.get(throttleMagnitude);
        let rudder = rudderPercentages.get(rudderMagnitude);

        if (throttleDirection === "BACKWARD") {
            throttle = throttle * -1;
        }

        if (rudderDirection === "LEFT") {
            rudder = rudder * -1;
        }

        const command: Engineering = {
            bot_id: props.botID,
            pid_control: {
                throttle: throttle,
                rudder: rudder,
            },
        };

        return command;
    };

    /**
     * Updates RC dive parameters in state
     *
     * @param {string} name Dive parameter changed
     * @param {number} value Updated dive parameter
     * @returns {void}
     */
    const handleRCDiveChange = (name: string, value: number) => {
        let mutableDiveParameters = { ...rcDiveParameters };
        switch (name) {
            case "max_depth":
                mutableDiveParameters.max_depth = value;
                break;
            case "depth_interval":
                mutableDiveParameters.depth_interval = value;
                break;
            case "hold_time":
                mutableDiveParameters.hold_time = value;
                break;
            case "drift_time":
                mutableDiveParameters.drift_time = value;
                break;
            default:
                console.log("Recieved invalid RC dive input name");
        }
        setRCDiveParameters(mutableDiveParameters);
    };

    /**
     * Packages and sends the RC dive command to the Bot
     *
     * @returns {void}
     */
    const handleRCDiveCommand = async () => {
        const diveParameters: MissionTask_DiveParameters = {
            max_depth: rcDiveParameters.max_depth,
            depth_interval: rcDiveParameters.depth_interval,
            hold_time: rcDiveParameters.hold_time,
            bottom_dive: false,
        };

        const driftParameters: MissionTask_DriftParameters = {
            drift_time: rcDiveParameters.drift_time,
        };

        const rcDiveCommand = {
            bot_id: props.botID,
            type: Command_CommandType.REMOTE_CONTROL_TASK,
            rc_task: {
                type: MissionTask_TaskType.DIVE,
                dive: diveParameters,
                surface_drift: driftParameters,
            },
        };
        const res = await sendBotCommand(rcDiveCommand);
        if (res.message) {
            error("Unable to send RC dive command");
        } else {
            success("Beginning RC dive");
        }
    };

    const RCSelectMenu = (
        <SelectMenu controlType={controlType} handleMenuSelection={handleMenuSelection} />
    );

    const RCDashboard = (
        <Dashboard
            throttleDirection={throttleDirection}
            throttleMagnitude={throttleMagnitude}
            rudderDirection={rudderDirection}
            rudderMagnitude={rudderMagnitude}
        />
    );

    const RCOverdrive = (
        <div className="overdrive-container">
            <div>Overdrive:</div>
            <JaiaToggle checked={() => rcOverdrive} onClick={handleOverdriveToggleClick} />
        </div>
    );

    const overdriveWarningDialog = (
        <OverdriveWarningDialog
            isVisible={isOverdriveDialogVisible}
            onClose={onOverdriveDialogClose}
        />
    );

    const RCMinimizedView = (
        <div className="remote-control-panel minimized">
            <div className="view-arrow minimized" onClick={() => setIsMinimizedView(false)}>
                <Icon path={mdiChevronUp} />
            </div>
        </div>
    );

    const RCMinimizeArrow = (
        <div className="view-arrow" onClick={() => setIsMinimizedView(true)}>
            <Icon path={mdiChevronDown} />
        </div>
    );

    switch (controlType) {
        case ControlTypes.SINGLE:
            if (isMinimizedView) {
                return RCMinimizedView;
            }
            return (
                <>
                    {overdriveWarningDialog}
                    {/* Gamepad component listens for Xbox controller input in background */}
                    <Gamepad
                        onAxisChange={(axisName, value) => {
                            if (axisName === "LeftStickY") {
                                handleAxisInput(value, AnalogStickTypes.LEFT);
                            } else if (axisName === "RightStickX") {
                                handleAxisInput(value, AnalogStickTypes.RIGHT);
                            }
                        }}
                    >
                        {/* Empty div required by react-gamepad library */}
                        <div></div>
                    </Gamepad>
                    <div className="remote-control-panel">
                        {RCMinimizeArrow}
                        <AnalogStick
                            analogStickType={AnalogStickTypes.SINGLE}
                            handleAnalogStickMove={(event) => {
                                handleAxisInput(event.y, AnalogStickTypes.LEFT);
                                handleAxisInput(event.x, AnalogStickTypes.RIGHT);
                            }}
                            onAnalogStickStop={onAnalogStickStop}
                        />
                        <div className="rc-dashboard">
                            <div className="selection-controls">
                                {RCSelectMenu}
                                {RCOverdrive}
                            </div>
                            {RCDashboard}
                        </div>
                    </div>
                </>
            );
        case ControlTypes.DUAL:
            if (isMinimizedView) {
                return RCMinimizedView;
            }
            return (
                <>
                    {overdriveWarningDialog}
                    {/* Gamepad component listens for Xbox controller input in background */}
                    <Gamepad
                        onAxisChange={(axisName, value) => {
                            if (axisName === "LeftStickY") {
                                handleAxisInput(value, AnalogStickTypes.LEFT);
                            } else if (axisName === "RightStickX") {
                                handleAxisInput(value, AnalogStickTypes.RIGHT);
                            }
                        }}
                    >
                        {/* Empty div required by react-gamepad library */}
                        <div></div>
                    </Gamepad>
                    <div className="remote-control-panel">
                        {RCMinimizeArrow}
                        <AnalogStick
                            analogStickType={AnalogStickTypes.LEFT}
                            handleAnalogStickMove={(event) =>
                                handleAxisInput(event.y, AnalogStickTypes.LEFT)
                            }
                            onAnalogStickStop={onAnalogStickStop}
                        />
                        <div className="rc-dashboard">
                            <div className="selection-controls">
                                {RCSelectMenu}
                                {RCOverdrive}
                            </div>
                            {RCDashboard}
                        </div>
                        <AnalogStick
                            analogStickType={AnalogStickTypes.RIGHT}
                            handleAnalogStickMove={(event) =>
                                handleAxisInput(event.x, AnalogStickTypes.RIGHT)
                            }
                            onAnalogStickStop={onAnalogStickStop}
                        />
                    </div>
                </>
            );
        case ControlTypes.DIVE:
            if (isMinimizedView) {
                return RCMinimizedView;
            }
            return (
                <>
                    {/* Gamepad component listens for Xbox controller input in background */}
                    <Gamepad
                        onAxisChange={(axisName, value) => {
                            if (axisName === "LeftStickY") {
                                handleAxisInput(value, AnalogStickTypes.LEFT);
                            } else if (axisName === "RightStickX") {
                                handleAxisInput(value, AnalogStickTypes.RIGHT);
                            }
                        }}
                    >
                        {/* Empty div required by react-gamepad library */}
                        <div></div>
                    </Gamepad>
                    <div className="remote-control-panel dive">
                        {RCMinimizeArrow}
                        <DiveInputs
                            rcDiveParameters={rcDiveParameters}
                            onChange={handleRCDiveChange}
                        />
                        <div className="rc-dashboard dive">
                            {RCSelectMenu}
                            <DiveCommand
                                rcDiveParameters={rcDiveParameters}
                                botId={props.botID}
                                handleRCDiveCommand={handleRCDiveCommand}
                            />
                        </div>
                    </div>
                </>
            );
    }
}

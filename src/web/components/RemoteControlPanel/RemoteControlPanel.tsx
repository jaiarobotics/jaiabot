import { useState, useEffect } from "react";

import { Joystick, JoystickShape } from "react-joystick-component";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

import { Engineering } from "../../types/protobuf-types";
import { sendEngineeringCommand } from "../../utils/commands";

import { createTheme, MenuItem, Select, SelectChangeEvent, ThemeProvider } from "@mui/material";

import "./RemoteControlPanel.less";

interface RemoteControlPanelProps {
    botID: number;
}

interface AnalogStickProps {
    analogStickType: AnalogStickTypes;
    handleAnalogStickMove: (event: IJoystickUpdateEvent, analogStickType: AnalogStickTypes) => void;
    onAnalogStickStop: () => void;
}

interface RCSelectMenuProps {
    controlType: ControlTypes;
    handleMenuSelection: (event: SelectChangeEvent) => void;
    throttleDirection: string;
    throttleMagnitude: number;
    rudderDirection: string;
    rudderMagnitude: number;
}

enum AnalogStickTypes {
    SINGLE = 1,
    LEFT = 2,
    RIGHT = 3,
}

// Use string values for MUI compatibility
enum ControlTypes {
    SINGLE = "SINGLE",
    DUAL = "DUAL",
    DIVE = "DIVE",
}

const throttlePercentages = new Map<number, number>([
    [1, 37.5],
    [2, 40],
    [3, 60],
]);

const rudderPercentages = new Map<number, number>([
    [1, 40],
    [2, 70],
    [3, 100],
]);

const DEAD_ZONE_PERCENT = 10;
const RC_COMMAND_TIMEOUT = 500; // milliseconds

// Style MUI select menu
const theme = createTheme({
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "white",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "white",
                    },
                },
                notchedOutline: {
                    borderColor: "white",
                    padding: "0px",
                },
            },
        },
    },
});

/**
 * Creates panel with analog sticks to manually control a Bot
 */
export default function RemoteControlPanel(props: RemoteControlPanelProps) {
    const [controlType, setControlType] = useState(ControlTypes.DUAL);
    const [throttleDirection, setThrottleDirection] = useState("");
    const [rudderDirection, setRudderDirection] = useState("");
    const [throttleMagnitude, setThrottleMagnitude] = useState(0);
    const [rudderMagnitude, setRudderMagnitude] = useState(0);

    // Include useEffect dependencies to prevent interval data from going stale
    useEffect(() => {
        const rcCommandInterval = setInterval(() => {
            sendEngineeringCommand(packageCommand());
        }, RC_COMMAND_TIMEOUT);

        return () => {
            clearInterval(rcCommandInterval);
        };
    }, [throttleDirection, throttleMagnitude, rudderDirection, rudderMagnitude]);

    /**
     * Updates throttle and rudder values when the analog stick moves
     *
     * @param {IJoystickUpdateEvent} event Contains the direction + magnitude of the movement
     * @param {AnalogStickTypes} analogStickType Which analog stick moved
     * @returns {void}
     */
    const handleAnalogStickMove = (
        event: IJoystickUpdateEvent,
        analogStickType: AnalogStickTypes,
    ) => {
        switch (analogStickType) {
            case AnalogStickTypes.SINGLE:
                setAnalogStickDirection(event, AnalogStickTypes.SINGLE);
                setAnalogStickMagnitude(event.y, AnalogStickTypes.LEFT);
                setAnalogStickMagnitude(event.x, AnalogStickTypes.RIGHT);
                break;

            case AnalogStickTypes.LEFT:
                setAnalogStickDirection(event, AnalogStickTypes.LEFT);
                setAnalogStickMagnitude(event.y, AnalogStickTypes.LEFT);
                break;

            case AnalogStickTypes.RIGHT:
                setAnalogStickDirection(event, AnalogStickTypes.RIGHT);
                setAnalogStickMagnitude(event.x, AnalogStickTypes.RIGHT);
                break;
        }
    };

    /**
     * Updates the throttle and rudder directions in state
     *
     * @param {IJoystickUpdateEvent} event Contains the direction of the movement
     * @param {AnalogStickTypes} analogStickType Which analog stick moved
     * @returns {void}
     */
    const setAnalogStickDirection = (
        event: IJoystickUpdateEvent,
        analogStickType: AnalogStickTypes,
    ) => {
        switch (analogStickType) {
            case AnalogStickTypes.SINGLE:
                // Throttle
                if (event.y > 0) {
                    setThrottleDirection("FORWARD");
                } else if (event.y < 0) {
                    setThrottleDirection("BACKWARD");
                }
                // Rudder (with deadzone)
                if (event.x * 100 > DEAD_ZONE_PERCENT) {
                    setRudderDirection("RIGHT");
                } else if (event.x * 100 < DEAD_ZONE_PERCENT * -1) {
                    setRudderDirection("LEFT");
                }
                break;
            case AnalogStickTypes.LEFT:
                setThrottleDirection(event.direction);
                break;
            case AnalogStickTypes.RIGHT:
                setRudderDirection(event.direction);
                break;
        }
    };

    /**
     * Updates throttle and rudder magnitudes in state
     *
     * @param {number} position Where the user moved the analog stick
     * @param {AnalogStickTypes} analogStickType Which analog stick moved
     * @returns {void}
     */
    const setAnalogStickMagnitude = (position: number, analogStickType: AnalogStickTypes) => {
        const absPosition = Math.abs(position) * 100;
        const isNegative = position < 0;
        let magnitude = 0;

        if (absPosition > DEAD_ZONE_PERCENT && position < 50) {
            magnitude = 1;
        }

        if (absPosition >= 50 && position <= 95) {
            magnitude = 2;
        }

        if (absPosition > 95) {
            magnitude = 3;
        }

        if (isNegative && analogStickType === AnalogStickTypes.LEFT) {
            // Only one speed in reverse
            magnitude = -1;
        }

        switch (analogStickType) {
            case AnalogStickTypes.LEFT:
                setThrottleMagnitude(magnitude);
                break;
            case AnalogStickTypes.RIGHT:
                setRudderMagnitude(magnitude);
                break;
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

    const SelectMenu = (
        <RCSelectMenu
            controlType={controlType}
            handleMenuSelection={handleMenuSelection}
            throttleDirection={throttleDirection}
            throttleMagnitude={throttleMagnitude}
            rudderDirection={rudderDirection}
            rudderMagnitude={rudderMagnitude}
        />
    );

    switch (controlType) {
        case ControlTypes.SINGLE:
            return (
                <div className="remote-control-panel">
                    <AnalogStick
                        analogStickType={AnalogStickTypes.SINGLE}
                        handleAnalogStickMove={handleAnalogStickMove}
                        onAnalogStickStop={onAnalogStickStop}
                    />
                    {SelectMenu}
                </div>
            );
        case ControlTypes.DUAL:
            return (
                <div className="remote-control-panel">
                    <AnalogStick
                        analogStickType={AnalogStickTypes.LEFT}
                        handleAnalogStickMove={handleAnalogStickMove}
                        onAnalogStickStop={onAnalogStickStop}
                    />
                    {SelectMenu}
                    <AnalogStick
                        analogStickType={AnalogStickTypes.RIGHT}
                        handleAnalogStickMove={handleAnalogStickMove}
                        onAnalogStickStop={onAnalogStickStop}
                    />
                </div>
            );
        case ControlTypes.DIVE:
            return <div className="remote-control-panel">{SelectMenu}</div>;
    }
}

/**
 * Designed to control the throttle and rudder of a Bot
 */
function AnalogStick(props: AnalogStickProps) {
    /**
     * Describes what the analog stick controls
     *
     * @returns {string} Name of analog stick
     */
    const getTitle = () => {
        switch (props.analogStickType) {
            case AnalogStickTypes.SINGLE:
                return "";
            case AnalogStickTypes.LEFT:
                return "Throttle";
            case AnalogStickTypes.RIGHT:
                return "Rudder";
        }
    };

    /**
     * Controls where the analog stick can move
     *
     * @returns {JoystickShape} What directions the analog stick moves
     */
    const getControlPlaneShape = () => {
        switch (props.analogStickType) {
            case AnalogStickTypes.LEFT:
                return JoystickShape.AxisY;
            case AnalogStickTypes.RIGHT:
                return JoystickShape.AxisX;
            default:
                return JoystickShape.Circle;
        }
    };

    return (
        <div className="analog-stick">
            <div>{getTitle()}</div>
            <Joystick
                baseColor="white"
                stickColor="black"
                controlPlaneShape={getControlPlaneShape()}
                size={100}
                throttle={100}
                move={(event: IJoystickUpdateEvent) =>
                    props.handleAnalogStickMove(event, props.analogStickType)
                }
                stop={() => props.onAnalogStickStop()}
            />
        </div>
    );
}

/**
 * Allows the operator to switch between single and dual analog sticks
 */
function RCSelectMenu(props: RCSelectMenuProps) {
    return (
        <ThemeProvider theme={theme}>
            <div className="rc-dashboard">
                <div className="rc-select-menu">
                    <div className="label">Control:</div>
                    <Select
                        value={props.controlType.toString()}
                        onChange={(event: SelectChangeEvent) => props.handleMenuSelection(event)}
                    >
                        <MenuItem value={ControlTypes.SINGLE}>Single</MenuItem>
                        <MenuItem value={ControlTypes.DUAL}>Dual</MenuItem>
                        <MenuItem value={ControlTypes.DIVE}>Dive</MenuItem>
                    </Select>
                </div>
                <div className="rc-output">
                    <div>Throttle Direction:</div>
                    <div>{props.throttleDirection}</div>
                    <div>Throttle:</div>
                    <div>{props.throttleMagnitude}</div>
                </div>
                <div className="rc-output">
                    <div>Rudder Direction:</div>
                    <div>{props.rudderDirection}</div>
                    <div>Rudder:</div>
                    <div>{props.rudderMagnitude}</div>
                </div>
            </div>
        </ThemeProvider>
    );
}

import { useState, useEffect } from "react";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

import { AnalogStick, AnalogStickTypes } from "./AnalogStick/AnalogStick";
import { SelectMenu, ControlTypes } from "./SelectMenu/SelectMenu";
import { Output } from "./Output/Output";
import { RCDiveCommand, RCDiveControls, RCDiveParameters } from "./DiveControls/DiveControls";

import { Engineering } from "../../types/protobuf-types";
import { sendEngineeringCommand } from "../../utils/commands";

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
                // Rudder
                if (event.x > 0) {
                    setRudderDirection("RIGHT");
                } else if (event.x < 0) {
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

        if (absPosition > RCZones.DEAD && position < RCZones.LOW) {
            magnitude = 1;
        }

        if (absPosition >= RCZones.LOW && position <= RCZones.HIGH) {
            magnitude = 2;
        }

        if (absPosition > RCZones.HIGH) {
            magnitude = 3;
        }

        if (isNegative && analogStickType === AnalogStickTypes.LEFT) {
            // Only one speed in reverse
            magnitude = 1;
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

    const handleRCDiveChange = (name: string, value: number) => {
        setRCDiveParameters((prev) => ({ ...prev, [name]: value }));
    };

    const RCSelectMenu = (
        <SelectMenu controlType={controlType} handleMenuSelection={handleMenuSelection} />
    );

    const RCOutput = (
        <Output
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
                        handleAnalogStickMove={(event) =>
                            handleAnalogStickMove(event, AnalogStickTypes.SINGLE)
                        }
                        onAnalogStickStop={onAnalogStickStop}
                    />
                    <div className="rc-dashboard">
                        {RCSelectMenu}
                        {RCOutput}
                    </div>
                </div>
            );
        case ControlTypes.DUAL:
            return (
                <div className="remote-control-panel">
                    <AnalogStick
                        analogStickType={AnalogStickTypes.LEFT}
                        handleAnalogStickMove={(event) =>
                            handleAnalogStickMove(event, AnalogStickTypes.LEFT)
                        }
                        onAnalogStickStop={onAnalogStickStop}
                    />
                    <div className="rc-dashboard">
                        {RCSelectMenu}
                        {RCOutput}
                    </div>
                    <AnalogStick
                        analogStickType={AnalogStickTypes.RIGHT}
                        handleAnalogStickMove={(event) =>
                            handleAnalogStickMove(event, AnalogStickTypes.RIGHT)
                        }
                        onAnalogStickStop={onAnalogStickStop}
                    />
                </div>
            );
        case ControlTypes.DIVE:
            return (
                <div className="remote-control-panel">
                    <div>
                        <RCDiveControls
                            rcDiveParameters={rcDiveParameters}
                            onChange={handleRCDiveChange}
                        />
                    </div>
                    <div className="rc-dashboard">
                        {RCSelectMenu}
                        {RCDiveCommand}
                    </div>
                </div>
            );
    }
}

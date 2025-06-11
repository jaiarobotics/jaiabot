import { useState } from "react";

import { Joystick, JoystickShape } from "react-joystick-component";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

import "./RemoteControlPanel.less";

interface AnalogStickProps {
    analogStickType: AnalogStickTypes;
    handleAnalogStickMove: (event: IJoystickUpdateEvent, analogStickType: AnalogStickTypes) => void;
}

export enum AnalogStickTypes {
    SINGLE = 1,
    LEFT = 2,
    RIGHT = 3,
}

const DEAD_ZONE_PERCENT = 10;

export default function RemoteControlPanel() {
    const [throttleDirection, setThrottleDirection] = useState("");
    const [rudderDirection, setRudderDirection] = useState("");
    const [throttleMagnitude, setThrottleMagnitude] = useState(0);
    const [rudderMagnitude, setRudderMagnitude] = useState(0);

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

    return (
        <div className="remote-control-panel">
            {/* <AnalogStick analogStickType={AnalogStickTypes.LEFT} handleAnalogStickMove={handleAnalogStickMove} /> */}
            {/* <AnalogStick analogStickType={AnalogStickTypes.RIGHT} handleAnalogStickMove={handleAnalogStickMove} /> */}
            {/* <AnalogStick analogStickType={AnalogStickTypes.SINGLE} handleAnalogStickMove={handleAnalogStickMove} /> */}
        </div>
    );
}

function AnalogStick(props: AnalogStickProps) {
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
        <div>
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
            />
        </div>
    );
}

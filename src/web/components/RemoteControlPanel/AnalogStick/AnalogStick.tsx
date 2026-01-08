import { Joystick, JoystickShape } from "react-joystick-component";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

export enum AnalogStickTypes {
    SINGLE = 1,
    LEFT = 2,
    RIGHT = 3,
}

export interface AnalogStickProps {
    analogStickType: AnalogStickTypes;
    handleAnalogStickMove: (event: IJoystickUpdateEvent, analogStickType: AnalogStickTypes) => void;
    onAnalogStickStop: () => void;
}

/**
 * Designed to control the throttle and rudder of a Bot
 */
export function AnalogStick(props: AnalogStickProps) {
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

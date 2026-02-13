import Gamepad from "react-gamepad";

export interface GamepadComponentProps {
    onButtonDown: (buttonName: string) => void;
    onButtonUp: (buttonName: string) => void;
    onAxisChange: (axisName: string, value: number) => void;
}

/**
 * Component for handling external gamepad/controller input
 */
export function GamepadComponent(props: GamepadComponentProps) {
    return (
        <div className="gamepad-component">
            <div className="gamepad-status">
                <h3>External Controller</h3>
                <p>Connect a game controller to control the bot</p>
                <p className="gamepad-instructions">
                    • Left stick: Throttle control<br />
                    • Right stick: Rudder control<br />
                    • Buttons: Additional controls
                </p>
            </div>
            <Gamepad
                onButtonDown={props.onButtonDown}
                onButtonUp={props.onButtonUp}
                onAxisChange={props.onAxisChange}
            >
                <div></div>
            </Gamepad>
        </div>
    );
}

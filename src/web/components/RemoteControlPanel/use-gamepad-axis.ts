import { useEffect, useRef } from "react";

// Standard gamepad axis order. A leading "-" marks an axis the browser reports
// inverted relative to the direction the stick is pushed.
const AXIS_LAYOUT = ["LeftStickX", "-LeftStickY", "RightStickX", "-RightStickY"];

const GAMEPAD_INDEX = 0;
const DEAD_ZONE = 0.08;

export type GamepadAxisName = "LeftStickX" | "LeftStickY" | "RightStickX" | "RightStickY";

function axisNameOf(layoutEntry: string) {
    return (layoutEntry.startsWith("-") ? layoutEntry.slice(1) : layoutEntry) as GamepadAxisName;
}

/**
 * Polls the connected gamepad and reports analog stick movement
 *
 * @param {Function} onAxisChange Called with the axis name and its value whenever the value changes
 * @param {boolean} enabled Whether to poll; while false the gamepad cannot drive the controls
 * @returns {void}
 */
export function useGamepadAxis(
    onAxisChange: (axisName: GamepadAxisName, value: number) => void,
    enabled: boolean,
) {
    const onAxisChangeRef = useRef(onAxisChange);
    onAxisChangeRef.current = onAxisChange;

    useEffect(() => {
        if (!enabled) {
            return;
        }

        // seeded at rest so a freshly connected pad does not report every axis as a change
        const axisValues = new Map<GamepadAxisName, number>(
            AXIS_LAYOUT.map((entry) => [axisNameOf(entry), 0]),
        );
        let animationFrame = 0;

        const poll = () => {
            const gamepad = navigator.getGamepads?.()[GAMEPAD_INDEX];

            gamepad?.axes.forEach((reportedValue, index) => {
                const layoutEntry = AXIS_LAYOUT[index];
                if (layoutEntry === undefined) {
                    return;
                }

                const inverted = layoutEntry.startsWith("-");
                const axisName = axisNameOf(layoutEntry);

                let value = inverted ? -reportedValue : reportedValue;
                if (Math.abs(value) < DEAD_ZONE) {
                    value = 0;
                }

                if (axisValues.get(axisName) !== value) {
                    axisValues.set(axisName, value);
                    onAxisChangeRef.current(axisName, value);
                }
            });

            animationFrame = requestAnimationFrame(poll);
        };

        animationFrame = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(animationFrame);
    }, [enabled]);
}

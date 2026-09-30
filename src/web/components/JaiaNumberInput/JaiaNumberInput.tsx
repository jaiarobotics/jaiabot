import { ChangeEvent } from "react";

import Icon from "@mdi/react";
import { mdiMenuUp, mdiMenuDown } from "@mdi/js";

import "./JaiaNumberInput.less";

interface StepperButtonsProps {
    onStep: (direction: number) => void;
    disabled?: boolean;
}

/**
 * Renders up/down buttons for a number field
 */
export function StepperButtons(props: StepperButtonsProps) {
    return (
        <div className="jaia-stepper">
            <button
                className="jaia-stepper-button"
                tabIndex={-1}
                disabled={props.disabled}
                aria-label="increment"
                onClick={() => props.onStep(1)}
            >
                <Icon path={mdiMenuUp} />
            </button>
            <button
                className="jaia-stepper-button"
                tabIndex={-1}
                disabled={props.disabled}
                aria-label="decrement"
                onClick={() => props.onStep(-1)}
            >
                <Icon path={mdiMenuDown} />
            </button>
        </div>
    );
}

interface Props {
    value: string;
    onChange: (evt: ChangeEvent<HTMLInputElement>) => void;
    name?: string;
    min?: number;
    disabled?: boolean;
    className?: string;
}

/**
 * Renders a number input with integrated increment/decrement buttons
 */
export default function JaiaNumberInput(props: Props) {
    /**
     * Applies a change to the current value and reports it via onChange
     *
     * @param {number} direction 1 to increment, -1 to decrement
     * @returns {void}
     */
    const handleStep = (direction: number) => {
        const current = Number(props.value);
        let next = (isNaN(current) ? 0 : current) + direction;
        if (props.min !== undefined && next < props.min) {
            next = props.min;
        }
        props.onChange({
            target: { name: props.name ?? "", value: next.toString() },
        } as unknown as ChangeEvent<HTMLInputElement>);
    };

    return (
        <div className="jaia-number-input">
            <input
                name={props.name}
                type="number"
                value={props.value}
                min={props.min}
                disabled={props.disabled}
                autoComplete="off"
                className={props.className}
                onChange={props.onChange}
            />
            <StepperButtons onStep={handleStep} disabled={props.disabled} />
        </div>
    );
}

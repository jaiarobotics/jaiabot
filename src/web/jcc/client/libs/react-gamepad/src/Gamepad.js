import React from "react";

import { XBOX } from "./layouts";

class Gamepad extends React.Component {
    static defaultProps = {
        layout: XBOX,

        stickThreshold: 0.5,
        deadZone: 0.08,

        gamepadIndex: 0,

        onConnect: () => {},
        onDisconnect: () => {},

        onButtonDown: () => {},
        onButtonUp: () => {},
        onButtonChange: () => {},
        onAxisChange: () => {},

        onA: () => {},
        onB: () => {},
        onX: () => {},
        onY: () => {},

        onStart: () => {},
        onBack: () => {},

        onLT: () => {},
        onRT: () => {},

        onLB: () => {},
        onRB: () => {},

        onLS: () => {},
        onRS: () => {},

        onUp: () => {},
        onDown: () => {},
        onLeft: () => {},
        onRight: () => {},
    };

    constructor(props, context) {
        super(props, context);

        this.padState = {
            connected: false,

            buttons: {
                A: false,
                B: false,
                X: false,
                Y: false,

                LB: false,
                LT: false,
                LS: false,

                RB: false,
                RT: false,
                RS: false,

                Start: false,
                Back: false,

                DPadUp: false,
                DPadRight: false,
                DPadDown: false,
                DPadLeft: false,
            },

            axis: {
                LeftStickX: 0.0,
                LeftStickY: 0.0,

                RightStickX: 0.0,
                RightStickY: 0.0,

                RightTrigger: 0.0,
                LeftTrigger: 0.0,
            },
        };
    }

    componentDidMount() {
        this.mounted = true;

        if (window && window.requestAnimationFrame)
            window.requestAnimationFrame(this.updateGamepad.bind(this));
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    updateGamepad() {
        if (!this.mounted) return;

        const gamepadIndex = this.props.gamepadIndex;
        const gamepads = navigator.getGamepads();

        if (gamepads.length && gamepads.length > gamepadIndex && gamepads[gamepadIndex]) {
            const gamepad = gamepads[gamepadIndex];

            if (!this.padState.connected) {
                this.padState.connected = true;
                this.props.onConnect(gamepadIndex);
            }

            this.updateAllButtons(gamepad);
            this.updateAllAxis(gamepad);
        } else if (this.padState.connected) {
            this.padState.connected = false;
            this.props.onDisconnect(gamepadIndex);
        }

        if (window && window.requestAnimationFrame)
            window.requestAnimationFrame(this.updateGamepad.bind(this));
    }

    updateAllButtons(gamepad) {
        for (let i = 0; i < gamepad.buttons.length; ++i) {
            const pressed = gamepad.buttons[i].pressed;
            const value = gamepad.buttons[i].value;

            let buttonName = this.buttonIndexToButtonName(i);
            this.updateButton(buttonName, pressed);

            let axisName = this.buttonIndexToAxisName(i);
            this.updateAxis(axisName, value);
        }
    }

    updateButton(buttonName, pressed) {
        if (this.padState.buttons[buttonName] === undefined) {
            return;
        }
        if (this.padState.buttons[buttonName] !== pressed) {
            this.padState.buttons[buttonName] = pressed;

            this.props.onButtonChange(buttonName, pressed);
            this.props[`onButton${pressed ? "Down" : "Up"}`](buttonName);
            if (pressed) this.props[`on${buttonName.replace("DPad", "")}`]();
        }
    }

    updateAllAxis(gamepad) {
        for (let i = 0; i < gamepad.axes.length; ++i) {
            let axisName = this.axisIndexToAxisName(i);
            const value = gamepad.axes[i];

            this.updateAxis(axisName, gamepad.axes[i]);
        }
    }

    updateAxis(axisName, originalValue) {
        if (
            axisName &&
            originalValue !== undefined &&
            originalValue !== null &&
            originalValue !== NaN
        ) {
            const invert = axisName[0] === "-";
            let value = originalValue * (invert ? -1 : 1);

            if (Math.abs(value) < this.props.deadZone) {
                value = 0;
            }

            if (invert) axisName = axisName.substr(1);

            if (this.padState.axis[axisName] !== value) {
                const previousValue = this.padState.axis[axisName];
                this.padState.axis[axisName] = value;

                this.props.onAxisChange(axisName, value, previousValue);

                if (axisName === "LeftStickX") {
                    if (
                        previousValue <= this.props.stickThreshold &&
                        value > this.props.stickThreshold
                    ) {
                        this.props.onRight();
                    }

                    if (
                        previousValue >= -this.props.stickThreshold &&
                        value < -this.props.stickThreshold
                    ) {
                        this.props.onLeft();
                    }
                }

                if (axisName === "LeftStickY") {
                    if (
                        previousValue <= this.props.stickThreshold &&
                        value > this.props.stickThreshold
                    ) {
                        this.props.onUp();
                    }

                    if (
                        previousValue >= -this.props.stickThreshold &&
                        value < -this.props.stickThreshold
                    ) {
                        this.props.onDown();
                    }
                }
            }
        }
    }

    buttonIndexToButtonName(index) {
        const { layout } = this.props;

        if (layout.buttons && layout.buttons.length >= index + 1) {
            return layout.buttons[index];
        }

        return null;
    }

    buttonIndexToAxisName(index) {
        const { layout } = this.props;

        if (layout.buttonAxis && layout.buttonAxis.length >= index + 1) {
            return layout.buttonAxis[index];
        }

        return null;
    }

    axisIndexToAxisName(index) {
        const { layout } = this.props;

        if (layout.axis && layout.axis.length >= index + 1) {
            return layout.axis[index];
        }

        return null;
    }

    render() {
        return React.Children.only(this.props.children);
    }
}

export default Gamepad;

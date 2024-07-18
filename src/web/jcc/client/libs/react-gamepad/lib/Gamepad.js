"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true,
});

var _createClass = (function () {
    function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
        }
    }
    return function (Constructor, protoProps, staticProps) {
        if (protoProps) defineProperties(Constructor.prototype, protoProps);
        if (staticProps) defineProperties(Constructor, staticProps);
        return Constructor;
    };
})();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _layouts = require("./layouts");

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
}

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

function _possibleConstructorReturn(self, call) {
    if (!self) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return call && (typeof call === "object" || typeof call === "function") ? call : self;
}

function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError(
            "Super expression must either be null or a function, not " + typeof superClass,
        );
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: { value: subClass, enumerable: false, writable: true, configurable: true },
    });
    if (superClass)
        Object.setPrototypeOf
            ? Object.setPrototypeOf(subClass, superClass)
            : (subClass.__proto__ = superClass);
}

var Gamepad = (function (_React$Component) {
    _inherits(Gamepad, _React$Component);

    function Gamepad(props, context) {
        _classCallCheck(this, Gamepad);

        var _this = _possibleConstructorReturn(
            this,
            (Gamepad.__proto__ || Object.getPrototypeOf(Gamepad)).call(this, props, context),
        );

        _this.padState = {
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
        return _this;
    }

    _createClass(Gamepad, [
        {
            key: "componentDidMount",
            value: function componentDidMount() {
                this.mounted = true;

                if (window && window.requestAnimationFrame)
                    window.requestAnimationFrame(this.updateGamepad.bind(this));
            },
        },
        {
            key: "componentWillUnmount",
            value: function componentWillUnmount() {
                this.mounted = false;
            },
        },
        {
            key: "updateGamepad",
            value: function updateGamepad() {
                if (!this.mounted) return;

                var gamepadIndex = this.props.gamepadIndex;
                var gamepads = navigator.getGamepads();

                if (gamepads.length && gamepads.length > gamepadIndex && gamepads[gamepadIndex]) {
                    var gamepad = gamepads[gamepadIndex];

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
            },
        },
        {
            key: "updateAllButtons",
            value: function updateAllButtons(gamepad) {
                for (var i = 0; i < gamepad.buttons.length; ++i) {
                    var pressed = gamepad.buttons[i].pressed;
                    var value = gamepad.buttons[i].value;

                    var buttonName = this.buttonIndexToButtonName(i);
                    this.updateButton(buttonName, pressed);

                    var axisName = this.buttonIndexToAxisName(i);
                    this.updateAxis(axisName, value);
                }
            },
        },
        {
            key: "updateButton",
            value: function updateButton(buttonName, pressed) {
                if (this.padState.buttons[buttonName] === undefined) {
                    return;
                }
                if (this.padState.buttons[buttonName] !== pressed) {
                    this.padState.buttons[buttonName] = pressed;

                    this.props.onButtonChange(buttonName, pressed);
                    this.props["onButton" + (pressed ? "Down" : "Up")](buttonName);
                    if (pressed) this.props["on" + buttonName.replace("DPad", "")]();
                }
            },
        },
        {
            key: "updateAllAxis",
            value: function updateAllAxis(gamepad) {
                for (var i = 0; i < gamepad.axes.length; ++i) {
                    var axisName = this.axisIndexToAxisName(i);
                    var value = gamepad.axes[i];

                    this.updateAxis(axisName, gamepad.axes[i]);
                }
            },
        },
        {
            key: "updateAxis",
            value: function updateAxis(axisName, originalValue) {
                if (
                    axisName &&
                    originalValue !== undefined &&
                    originalValue !== null &&
                    originalValue !== NaN
                ) {
                    var invert = axisName[0] === "-";
                    var value = originalValue * (invert ? -1 : 1);

                    if (Math.abs(value) < this.props.deadZone) {
                        value = 0;
                    }

                    if (invert) axisName = axisName.substr(1);

                    if (this.padState.axis[axisName] !== value) {
                        var previousValue = this.padState.axis[axisName];
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
            },
        },
        {
            key: "buttonIndexToButtonName",
            value: function buttonIndexToButtonName(index) {
                var layout = this.props.layout;

                if (layout.buttons && layout.buttons.length >= index + 1) {
                    return layout.buttons[index];
                }

                return null;
            },
        },
        {
            key: "buttonIndexToAxisName",
            value: function buttonIndexToAxisName(index) {
                var layout = this.props.layout;

                if (layout.buttonAxis && layout.buttonAxis.length >= index + 1) {
                    return layout.buttonAxis[index];
                }

                return null;
            },
        },
        {
            key: "axisIndexToAxisName",
            value: function axisIndexToAxisName(index) {
                var layout = this.props.layout;

                if (layout.axis && layout.axis.length >= index + 1) {
                    return layout.axis[index];
                }

                return null;
            },
        },
        {
            key: "render",
            value: function render() {
                return _react2.default.Children.only(this.props.children);
            },
        },
    ]);

    return Gamepad;
})(_react2.default.Component);

Gamepad.defaultProps = {
    layout: _layouts.XBOX,

    stickThreshold: 0.5,
    deadZone: 0.08,

    gamepadIndex: 0,

    onConnect: function onConnect() {},
    onDisconnect: function onDisconnect() {},

    onButtonDown: function onButtonDown() {},
    onButtonUp: function onButtonUp() {},
    onButtonChange: function onButtonChange() {},
    onAxisChange: function onAxisChange() {},

    onA: function onA() {},
    onB: function onB() {},
    onX: function onX() {},
    onY: function onY() {},

    onStart: function onStart() {},
    onBack: function onBack() {},

    onLT: function onLT() {},
    onRT: function onRT() {},

    onLB: function onLB() {},
    onRB: function onRB() {},

    onLS: function onLS() {},
    onRS: function onRS() {},

    onUp: function onUp() {},
    onDown: function onDown() {},
    onLeft: function onLeft() {},
    onRight: function onRight() {},
};
exports.default = Gamepad;

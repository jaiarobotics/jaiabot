import React, { ReactElement } from "react";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Button from "@mui/material/Button";
const { Gamepad } = require("../libs/react-gamepad");
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import { Icon } from "@mdi/react";
import { error, success } from "../libs/notifications";
import { mdiPlay } from "@mdi/js";
import { JaiaAPI } from "../../common/JaiaAPI";
import { Engineering } from "./shared/JAIAProtobuf";
import { PortalBotStatus } from "./shared/PortalStatus";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";
import { TaskType, CommandType } from "./shared/JAIAProtobuf";
import { Joystick, JoystickShape } from "react-joystick-component";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { CustomAlert } from "./shared/CustomAlert";
import { Typography } from "@mui/material";
import JaiaToggle from "./JaiaToggle";

interface Props {
    api: JaiaAPI;
    bot: PortalBotStatus;
    isRCModeActive: boolean;
    remoteControlValues: Engineering;
    rcDiveParameters: { [diveParam: string]: string };
    createInterval: () => void;
    deleteInterval: () => void;
    weAreInControl: () => boolean;
    weHaveInterval: () => boolean;
    setRCDiveParameters: (diveParams: { [param: string]: string }) => void;
    initRCDivesParams: (botId: number) => void;
}

interface State {
    controlType: string;
    isJoyStickStart: boolean;
    joyStickStatus: { [joyStick: string]: boolean };
    throttleDirection: string;
    rudderDirection: string;
    throttleBinNumber: number;
    rudderBinNumber: number;
    botId: number;
    isMaximized: boolean;
    overdriveEnabled: boolean;
}

enum JoySticks {
    LEFT = "LEFT",
    RIGHT = "RIGHT",
    SOLE = "SOLE",
}

enum ControlTypes {
    MANUAL_DUAL = "MANUAL_DUAL",
    MANUAL_SINGLE = "MANUAL_SINGLE",
    DIVE = "DIVE",
}

type Bin = { binNumber: number; binValue: number };

export default class RCControllerPanel extends React.Component {
    api: JaiaAPI;
    props: Props;
    state: State;

    /**
     * Constructor for the RCControllerPanel.
     * Defines props and state used by the panel and provides initial settings.
     * @param props properties passed down from parent
     */
    constructor(props: Props) {
        super(props);
        this.api = props.api;

        // Check to see if rc dive parameters are
        // saved in state
        if (props.rcDiveParameters === undefined) {
            props.initRCDivesParams(props.bot.bot_id);
        }

        this.state = {
            controlType: ControlTypes.MANUAL_DUAL,
            isJoyStickStart: false,
            joyStickStatus: {
                left: true,
                right: true,
                sole: false,
            },
            throttleDirection: "",
            rudderDirection: "",
            throttleBinNumber: 0,
            rudderBinNumber: 0,
            // bot id is saved to determine when the user
            // clicks on a new bot details window
            botId: 0,
            isMaximized: true,
            overdriveEnabled: false,
        };
    }

    updateThrottleDirectionMove(event: IJoystickUpdateEvent) {
        let throttleBin: Bin = { binNumber: 0, binValue: 0 };
        if (event.direction.toString() === "FORWARD") {
            this.calcThrottleBinNum(event.y * 100, "FORWARD", throttleBin);
            this.props.remoteControlValues.pid_control.throttle = throttleBin.binValue;
        } else if (event.direction.toString() === "BACKWARD") {
            this.calcThrottleBinNum(event.y * 100, "BACKWARD", throttleBin);
            this.props.remoteControlValues.pid_control.throttle = throttleBin.binValue;
        }
        this.setState(
            { throttleDirection: event.direction.toString(), throttleBinNumber: throttleBin.binNumber },
            () => {},
        );
    }
    
    /**
     * Checks to see if Overdrive has been enabled
     *
     * @returns {boolean}
     */
    isOverdriveChecked() {
        return this.state.overdriveEnabled;
    }

    /**
     * Posts a confirmation dialog to confirm use of Overdrive
     * If confirmed enables Overdrive
     *
     * @returns {void}
     */
    async handleOverdriveCheck() {

        if (!this.state.overdriveEnabled){
            if (
                !(await CustomAlert.confirmAsync(
                    "You are about to enable Overdrive.  \nUse Overdrive with caution as it can make the bots difficult to control",
                    "Enable Overdrive"
                ))
            ) {
                return;
            }  
        }

        this.setState({overdriveEnabled: !this.state.overdriveEnabled});
        return;
    }

    /**
     * Creates the bins for throttle that are used as output for the operator
     *
     * @param {number} speed is the position of the input that is used to determine bin number
     * @param {string} throttleDirection determines the direction of the throttle (FORWARD, BACKWARD)
     * @param {Bin} throttleBin used to pass the bin number and value
     * @returns {number}
     *
     * @notes
     * Need template for object parameters
     */
    calcThrottleBinNum(
        speed: number,
        throttleDirection: string,
        throttleBin: Bin,
    ) {
        // Basic error handling to protect against unexpected speed value
        if (!speed || speed === 0) {
            return 0;
        }

        //boost throttle settings if overdrive is enabled
        let boost: Bin = { binNumber: 0, binValue: 0 };
        if (this.state.overdriveEnabled) boost = {binNumber: 1, binValue: 20 }

        if (throttleDirection === "FORWARD") {
            // This means our max forward throttle would be 40 or speed 2 unless overdrive enabled
            if (speed <= 50){ // under 50 never use boost
                throttleBin.binNumber = 1;
                throttleBin.binValue = 20;
            }
            else if (speed <= 95) {
                throttleBin.binNumber = 1 + boost.binNumber;
                throttleBin.binValue = 20 + boost.binValue;
            } else if (speed > 95) {
                throttleBin.binNumber = 2 + boost.binNumber;
                throttleBin.binValue = 40+ boost.binValue;
            }
        } else if (throttleDirection === "BACKWARD") {
            // This means our max backward throttle would be 10 or speed 0.5.
            throttleBin.binNumber = 1;
            throttleBin.binValue = -10;
        }
    }
    /**
     * Sets the Throttle Value and Direction to 0 when stopped
     */
    updateThrottleDirectionStop() {
        this.props.remoteControlValues.pid_control.throttle = 0;
        this.setState({ throttleDirection: "", throttleBinNumber: 0 });
    }
    /**
     * Updates the ruder direction when rudder "joystic" is moved on a tablet
     * @param event Event data from Joystick widget
     */
    updateRudderDirectionMove(event: IJoystickUpdateEvent) {
        let rudderBin: Bin = { binNumber: 0, binValue: 0 };
        // The is used to only detect changes if the value is above
        // this percentage (Added when using tablet controller)
        let deadzonePercent = 10;
        this.calcRudderBinNum(event.x * 100, rudderBin, deadzonePercent);
        this.props.remoteControlValues.pid_control.rudder = rudderBin.binValue;
        this.setState({
            rudderDirection: event.direction.toString(),
            rudderBinNumber: rudderBin.binNumber,
        });
    }

    /**
     * Sets Rudder values
     * @param position value from Joystick 
     * @param rudderBin current Bin values for the rudder
     * @param deadzonePercent deadzone in percentage of joystick movement to ignore
     * @returns {void}
     */
    calcRudderBinNum(
        position: number,
        rudderBin: Bin,
        deadzonePercent: number,
    ) {
        // Basic error handling to protect against unexpected position value
        if (!position) {
            return;
        }

        // Added a deadzone
        if (position > deadzonePercent && position < 50) {
            rudderBin.binNumber = 1;
            rudderBin.binValue = 40;
        } else if (position >= 50 && position <= 95) {
            rudderBin.binNumber = 2;
            rudderBin.binValue = 70;
        } else if (position > 95) {
            rudderBin.binNumber = 3;
            rudderBin.binValue = 100;
        } else if (position < -deadzonePercent && position > -50) {
            rudderBin.binNumber = 1;
            rudderBin.binValue = -40;
        } else if (position <= -50 && position >= -95) {
            rudderBin.binNumber = 2;
            rudderBin.binValue = -70;
        } else if (position < -95) {
            rudderBin.binNumber = 3;
            rudderBin.binValue = -100;
        }
    }

    /**
     * Sets rudder values to 0 when stopped
     */
    updateRudderDirectionStop() {
        this.props.remoteControlValues.pid_control.rudder = 0;
        this.setState({ rudderDirection: "", rudderBinNumber: 0 });
    }

    /**
     * Sets Throttle and Rudder values for Solo Controller
     * @param event Event data from the Joystick widget
     */
    moveSoloController(event: IJoystickUpdateEvent) {
        let throttleDirection = "";
        let rudderDirection = "";
        let throttleBinNumber = 0;
        let rudderBinNumber = 0;

        let thottleBin: Bin = { binNumber: 0, binValue: 0 };
        let rudderBin: Bin = { binNumber: 0, binValue: 0 };

        // The is used to only detect changes if the value is above
        // this percentage (Added when using tablet controller)
        let deadzonePercent = 10;

        if (event.y > 0) {
            throttleDirection = "FORWARD";
        } else if (event.y < 0) {
            throttleDirection = "BACKWARD";
        }

        // Added a deadzone
        if (event.x * 100 > 10) {
            rudderDirection = "RIGHT";
        } else if (event.x * 100 < -10) {
            rudderDirection = "LEFT";
        }

        this.calcThrottleBinNum(event.y * 100, throttleDirection, thottleBin);
        this.props.remoteControlValues.pid_control.throttle = thottleBin.binValue;
        throttleBinNumber = thottleBin.binNumber;

        this.calcRudderBinNum(event.x * 100, rudderBin, deadzonePercent);
        this.props.remoteControlValues.pid_control.rudder = rudderBin.binValue;
        rudderBinNumber = rudderBin.binNumber;

        this.setState({
            throttleDirection,
            rudderDirection,
            throttleBinNumber,
            rudderBinNumber,
        });
    }

    /**
     * This handles the input from the xbox controller by mapping the value
     * of the inputs to a bin number and direction to give the user feedback
     * @param axisName string - indicates the analog stick that is being controlled
     * @param value number - indicates the position of the analog stick
     */
    handleGamepadAxisChange(axisName: string, value: number) {
        const controlType = this.state.controlType;

        let throttleDirection = this.state.throttleDirection;
        let rudderDirection = this.state.rudderDirection;
        let throttleBinNumber = this.state.throttleBinNumber;
        let rudderBinNumber = this.state.rudderBinNumber;

        let valuePercent = value * 100;

        // The is used to only detect changes if the value is above
        // this percentage (Added when using xbox controller)
        let deadzonePercent = 15;

        // Rudder Handler
        if (
            axisName === (controlType === ControlTypes.MANUAL_SINGLE ? "LeftStickX" : "RightStickX")
        ) {
            let rudderBin: Bin = { binNumber: 0, binValue: 0 };

            this.calcRudderBinNum(valuePercent, rudderBin, deadzonePercent);
            this.props.remoteControlValues.pid_control.rudder = rudderBin.binValue;
            rudderBinNumber = rudderBin.binNumber;

            // Added a deadzone
            if (valuePercent > deadzonePercent) {
                rudderDirection = "RIGHT";
            } else if (valuePercent < -deadzonePercent) {
                rudderDirection = "LEFT";
            } else {
                rudderDirection = "";
                this.props.remoteControlValues.pid_control.rudder = 0;
                rudderBinNumber = 0;
            }
            this.setState({
                rudderDirection,
                rudderBinNumber,
            });
        }

        // Throttle Handler
        if (axisName === "LeftStickY") {
            let throttleBin: Bin = { binNumber: 0, binValue: 0 };
            // Added a deadzone
            if (valuePercent > deadzonePercent) {
                throttleDirection = "FORWARD";
                this.calcThrottleBinNum(valuePercent, throttleDirection, throttleBin);
                this.props.remoteControlValues.pid_control.throttle = throttleBin.binValue;
                throttleBinNumber = throttleBin.binNumber;
            } else if (valuePercent < -deadzonePercent) {
                throttleDirection = "BACKWARD";
                this.calcThrottleBinNum(valuePercent, throttleDirection, throttleBin);
                this.props.remoteControlValues.pid_control.throttle = throttleBin.binValue;
                throttleBinNumber = throttleBin.binNumber;
            } else {
                throttleDirection = "";
                this.props.remoteControlValues.pid_control.throttle = 0;
                throttleBinNumber = 0;
            }
            this.setState({
                throttleDirection,
                throttleBinNumber,
            });
        }
    }

    controlChange(event: SelectChangeEvent) {
        const controlType = event.target.value.toUpperCase();
        if (controlType === ControlTypes.MANUAL_SINGLE) {
            this.setJoyStickStatus([JoySticks.SOLE]);
        } else if (controlType === ControlTypes.MANUAL_DUAL) {
            this.setJoyStickStatus([JoySticks.LEFT, JoySticks.RIGHT]);
        } else if (controlType === ControlTypes.DIVE) {
            this.setJoyStickStatus([]);
        }
        this.setState({ controlType });
    }

    setJoyStickStatus(joySticksOn: JoySticks[]) {
        const joyStickStatus = this.state.joyStickStatus;
        for (const key of Object.keys(joyStickStatus)) {
            if (joySticksOn.includes(key.toUpperCase() as JoySticks)) {
                joyStickStatus[key] = true;
            } else {
                joyStickStatus[key] = false;
            }
        }
        this.setState({ joyStickStatus });
    }

    handleTaskParamInputChange(evt: React.ChangeEvent<HTMLInputElement>) {
        const input = evt.target.value;
        const paramType = evt.target.id;
        const diveParams = { ...this.props.rcDiveParameters };

        if (Number.isNaN(Number(input)) || Number(input) < 0) {
            CustomAlert.alert("Please enter only positive numbers for dive parameters");
            return;
        }

        diveParams[paramType] = input;
        this.props.setRCDiveParameters(diveParams);
    }

    /**
     * Clears the interval to send RC commands and sends a dive task
     *
     * returns {void}
     */
    handleDiveButtonClick() {
        const diveParametersNum: { [diveParam: string]: number } = {};
        const driftParametersNum: { [driftParam: string]: number } = {};

        // delete interval so the bot does not receive engineering commands
        this.props.deleteInterval();

        for (const key of Object.keys(this.props.rcDiveParameters)) {
            if (key === "driftTime") {
                driftParametersNum[key] = Number(this.props.rcDiveParameters[key]);
            } else {
                diveParametersNum[key] = Number(this.props.rcDiveParameters[key]);
            }
        }

        const rcDiveCommand = {
            bot_id: this.props.bot?.bot_id,
            type: CommandType.REMOTE_CONTROL_TASK,
            rc_task: {
                type: TaskType.DIVE,
                dive: diveParametersNum,
                surface_drift: driftParametersNum,
            },
        };

        this.api.postCommand(rcDiveCommand).then((response) => {
            if (response.message) {
                error("Unable to post RC dive command");
            } else {
                success("Beginning RC dive");
            }
        });
    }

    isDiveButtonDisabled() {
        for (const value of Object.values(this.props.rcDiveParameters)) {
            if (value === "") {
                return true;
            }
        }
        return false;
    }

    clearRemoteControlValues() {
        this.props.remoteControlValues.pid_control.throttle = 0;
        this.props.remoteControlValues.pid_control.rudder = 0;
        this.setState({
            throttleDirection: "",
            rudderDirection: "",
            throttleBinNumber: 0,
            rudderBinNumber: 0,
        });
    }

    render() {
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

        // Create the Select Object
        let selectControlType = (
            <div className="rc-dropdown">
                <div>Control:</div>
                <ThemeProvider theme={theme}>
                    <Select
                        labelId="control-type-select-label"
                        id="control-type-select"
                        value={this.state.controlType}
                        label="Assign"
                        onChange={(e: SelectChangeEvent) => this.controlChange(e)}
                        sx={{ color: "white", fontSize: "1.25rem" }}
                        input={
                            <OutlinedInput
                                notched
                                sx={{
                                    "&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "red",
                                    },
                                    "&.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor: "blue",
                                        },
                                    "&.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor: "green",
                                        },
                                }}
                            />
                        }
                    >
                        <MenuItem key={1} value={ControlTypes.MANUAL_DUAL}>
                            Manual Dual
                        </MenuItem>
                        <MenuItem key={2} value={ControlTypes.MANUAL_SINGLE}>
                            Manual Single
                        </MenuItem>
                        <MenuItem key={3} value={ControlTypes.DIVE}>
                            Dive
                        </MenuItem>
                    </Select>
                </ThemeProvider>
            </div>
        );

        let leftController: ReactElement;
        let rightController: ReactElement;
        let soleController: ReactElement;
        let driveControlPad: ReactElement;
        let diveControlPad: ReactElement;

        leftController = (
            <div
                className={`controller ${this.state.joyStickStatus["left"] ? "" : "hide-controller"}`}
            >
                <div className="controller-title">Throttle</div>
                <Joystick
                    baseColor="white"
                    stickColor="black"
                    controlPlaneShape={JoystickShape.AxisY}
                    size={100}
                    throttle={100}
                    start={() => {
                        if (!this.props.weHaveInterval()) {
                            this.props.createInterval();
                        }
                    }}
                    move={(e: IJoystickUpdateEvent) => this.updateThrottleDirectionMove(e)}
                    stop={() => this.updateThrottleDirectionStop()}
                />
            </div>
        );

        rightController = (
            <div
                className={`controller ${this.state.joyStickStatus["right"] ? "" : "hide-controller"}`}
            >
                <div className="controller-title">Rudder</div>
                <Joystick
                    baseColor="white"
                    stickColor="black"
                    controlPlaneShape={JoystickShape.AxisX}
                    size={100}
                    throttle={100}
                    start={() => {
                        if (!this.props.weHaveInterval()) {
                            this.props.createInterval();
                        }
                    }}
                    move={(e: IJoystickUpdateEvent) => this.updateRudderDirectionMove(e)}
                    stop={() => this.updateRudderDirectionStop()}
                />
            </div>
        );

        soleController = (
            <div
                className={`controller ${this.state.joyStickStatus["sole"] ? "" : "hide-controller"}`}
            >
                <Joystick
                    baseColor="white"
                    stickColor="black"
                    size={100}
                    throttle={100}
                    start={() => {
                        if (!this.props.weHaveInterval()) {
                            this.props.createInterval();
                        }
                    }}
                    move={(e: IJoystickUpdateEvent) => this.moveSoloController(e)}
                    stop={() => this.clearRemoteControlValues()}
                />
            </div>
        );

        driveControlPad = (
            <div className="rc-labels-container">
                
                <div className="rc-labels-left">
                    {selectControlType}
                    <div className="rc-info-container">
                        <div>Throttle Direction:</div>
                        <div className="rc-data">{this.state.throttleDirection}</div>
                        <div>Throttle:</div>
                        <div className="rc-data">{this.state.throttleBinNumber}</div>
                    </div>
                    <div className="rc-info-container">
                        <div>Rudder Direction:</div>
                        <div className="rc-data">{this.state.rudderDirection}</div>
                        <div>Rudder:</div>
                        <div className="rc-data">{this.state.rudderBinNumber}</div>
                    </div>
                </div>
                <div className="rc-labels-right">
                    <div className="rc-adv-speed-container">
                        <div>Overdrive Speed</div>
                        <JaiaToggle
                            checked={() => this.isOverdriveChecked()}
                            onClick={() => this.handleOverdriveCheck()}
                            disabled={() => false}
                        />
                    </div>

                </div>
            </div>
        );

        if (this.props.rcDiveParameters !== undefined) {
            diveControlPad = (
                <div className="rc-labels-container">
                    <div className="rc-labels-left">
                        {selectControlType}
                        <div className="rc-dive-info-container">
                            <div>Max Depth:</div>
                            <input
                                id="maxDepth"
                                className="rc-input"
                                type="text"
                                value={this.props.rcDiveParameters?.maxDepth}
                                onChange={(evt: React.ChangeEvent<HTMLInputElement>) =>
                                    this.handleTaskParamInputChange(evt)
                                }
                                autoComplete="off"
                            />
                            <div>m</div>

                            <div>Depth Interval:</div>
                            <input
                                id="depthInterval"
                                className="rc-input"
                                type="text"
                                value={this.props.rcDiveParameters?.depthInterval}
                                onChange={(evt: React.ChangeEvent<HTMLInputElement>) =>
                                    this.handleTaskParamInputChange(evt)
                                }
                                autoComplete="off"
                            />
                            <div>m</div>

                            <div>Hold Time:</div>
                            <input
                                id="holdTime"
                                className="rc-input"
                                type="text"
                                value={this.props.rcDiveParameters?.holdTime}
                                onChange={(evt: React.ChangeEvent<HTMLInputElement>) =>
                                    this.handleTaskParamInputChange(evt)
                                }
                                autoComplete="off"
                            />
                            <div>s</div>

                            <div>Drift Time:</div>
                            <input
                                id="driftTime"
                                className="rc-input"
                                type="text"
                                value={this.props.rcDiveParameters?.driftTime}
                                onChange={(evt: React.ChangeEvent<HTMLInputElement>) =>
                                    this.handleTaskParamInputChange(evt)
                                }
                                autoComplete="off"
                            />
                            <div>s</div>
                        </div>
                    </div>
                    <div className="rc-labels-right">
                        <Button
                            className={`button-jcc button-rc-dive ${this.isDiveButtonDisabled() ? "inactive" : ""}`}
                            disabled={this.isDiveButtonDisabled()}
                            onClick={() => this.handleDiveButtonClick()}
                        >
                            <Icon path={mdiPlay} title="Run Mission" />
                        </Button>
                    </div>
                </div>
            );
        }

        if (this.props.bot?.bot_id !== undefined) {
            // Set the remoteControlValues to the selected bot id
            this.props.remoteControlValues.bot_id = this.props.bot.bot_id;
        }

        const contents = (
            <div className="stick-container">
                {this.state.controlType === ControlTypes.MANUAL_DUAL
                    ? leftController
                    : soleController}

                {this.state.controlType === ControlTypes.DIVE ? diveControlPad : driveControlPad}

                {rightController}

                <Gamepad
                    // Not using gamepad deadzone so we can handle it in our
                    // handleGamepadAxisChange
                    deadZone={0}
                    onConnect={() => {
                        console.log("connected");
                        if (!this.props.weHaveInterval()) {
                            this.props.createInterval();
                        }
                        this.clearRemoteControlValues();
                    }}
                    onAxisChange={(axisName: string, value: number) => {
                        // Need to check for interval because onConnect is
                        // only called at the start and does not get called again
                        // if we are switching between bots
                        if (!this.props.weHaveInterval()) {
                            this.props.createInterval();
                        }
                        this.handleGamepadAxisChange(axisName, value);
                    }}
                >
                    <React.Fragment />
                </Gamepad>
            </div>
        );

        /**
        * Toggle minimize/maximize state of the RC panel.
        * Tapping anywhere on the heading will toggle this.
        */
        const toggleMinimize = () => {
            this.setState({ isMaximized: !this.state.isMaximized });
        };

        /**
        * Buttons to indicate the ability to toggle the minimize/maximize state.
        * They don't need an onClick handler, because the whole heading is sensitive to clicks.
        */
        const toggleMinimizeIndicator = (
            <Button>
                <Typography>{this.state.isMaximized ? "^" : "˅"}</Typography>
            </Button>
        );

        return (
            <div id="remoteControlPanelContainer">
                <div className="rc-heading" onClick={toggleMinimize}>
                    {toggleMinimizeIndicator}
                    Remote Control Panel: Bot {this.props.bot.bot_id}
                    {toggleMinimizeIndicator}
                </div>

                {this.state.isMaximized ? contents : null}
            </div>
        );
    }
}

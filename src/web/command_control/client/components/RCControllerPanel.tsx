import React, { ReactElement } from 'react'
import {JaiaAPI} from '../../common/JaiaAPI'
import { Joystick, JoystickShape } from 'react-joystick-component'
import { Engineering } from './shared/JAIAProtobuf'
import { PortalBotStatus } from './shared/PortalStatus'
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import OutlinedInput from '@mui/material/OutlinedInput';
import Gamepad from 'react-gamepad';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick'

interface Props {
	api: JaiaAPI,
	bot: PortalBotStatus,
	isRCModeActive: boolean,
	remoteControlValues: Engineering,
	createInterval: () => void,
	clearInterval: () => void,
	weAreInControl: () => boolean,
	weHaveInterval: () => boolean
}

interface State {
	isJoyStickStart: boolean,
	throttleDirection: string,
	rudderDirection: string,
	controlType: string
}

export default class RCControllerPanel extends React.Component {
	api: JaiaAPI
	props: Props
	state: State
	// Take 40 % of the event distance provides 
	// This means our max forward throttle would be 40 or 2 m/s.
	limitForwardThrottle: number = 0.4 
	// Take 10 % of the event distance provides 
	// This means our max backward throttle would be 10 or 0.5 m/s.
	limitBackwardThrottle: number = 0.1

    constructor(props: Props) {
        super(props)
        this.api = props.api

        this.state = {
			isJoyStickStart: false,
			throttleDirection: "",
			rudderDirection: "",
			controlType: "Manual Dual"
        }
    }

	updateThrottleDirectionMove(event: IJoystickUpdateEvent) {
		if (event.direction.toString() === "FORWARD") {
			this.props.remoteControlValues.pid_control.throttle = (event.y * 100) * this.limitForwardThrottle
		} else if (event.direction.toString() === "BACKWARD") {
			this.props.remoteControlValues.pid_control.throttle = (event.y * 100) * this.limitBackwardThrottle
		}

		this.setState({ throttleDirection: event.direction.toString() })		
	}

	updateThrottleDirectionStop() {
		this.props.remoteControlValues.pid_control.throttle = 0
		this.setState({ throttleDirection: "" })
	}

	updateRudderDirectionMove(event: IJoystickUpdateEvent) {
		const rudderAdjustValue = this.adjustThrottleResponse(event.x)
		this.props.remoteControlValues.pid_control.rudder = rudderAdjustValue
		this.setState({ rudderDirection: event.direction.toString() })
	}

	updateRudderDirectionStop() {
		this.props.remoteControlValues.pid_control.rudder = 0
		this.setState({ rudderDirection: "" })
	}

	moveSoloController(event: IJoystickUpdateEvent) {
		let rudderAdjustValue = this.adjustThrottleResponse(event.x)
		let throttleDirection: string
		let rudderDirection: string

		if (event.y >= 0) {
			this.props.remoteControlValues.pid_control.throttle = (event.y * 100) * this.limitForwardThrottle
			throttleDirection = "FORWARD"
		} else if (event.y < 0) {
			this.props.remoteControlValues.pid_control.throttle = (event.y * 100) * this.limitBackwardThrottle
			throttleDirection = "BACKWARD"
		}

		this.props.remoteControlValues.pid_control.rudder = rudderAdjustValue

		if (event.x >= 0) {
			rudderDirection = "RIGHT"
		} else if (event.x < 0) {
		    rudderDirection = "LEFT"
		}

		this.setState({ throttleDirection, rudderDirection })
	}

	handleGamepadAxisChange(axisName: string, rudderAdjustValue: number, value: number) {
		const controlType = this.state.controlType
		let throttleDirection: string
		let rudderDirection: string

		if (axisName === (controlType === "Manual Single" ? "LeftStickX" : "RightStickX")) {
			this.props.remoteControlValues.pid_control.rudder = rudderAdjustValue
			if (value > 0) {
				rudderDirection = "RIGHT"
			} else if (value < 0) {
				rudderDirection = "LEFT"
			} else if (value === 0) {
				rudderDirection = ""
				this.props.remoteControlValues.pid_control.rudder = 0
			}
		} 
		
		if (axisName === "LeftStickY") {	
			if (value > 0) {
				throttleDirection = "FORWARD"
				this.props.remoteControlValues.pid_control.throttle = (value * 100) * this.limitForwardThrottle
			} else if (value < 0) {
				throttleDirection = "BACKWARD"
				this.props.remoteControlValues.pid_control.throttle = (value * 100) * this.limitBackwardThrottle
			} else if(value === 0) {
				throttleDirection = ""
				this.props.remoteControlValues.pid_control.throttle = 0
			}
		}
		
		if (throttleDirection) {
			this.setState({ throttleDirection })
		}

		if (rudderDirection) {
			this.setState({ rudderDirection })
		}
	}

	controlChange(event: SelectChangeEvent) {
		console.log(event.target)
		this.setState({ controlType: event.target.value })
	}

	clearRemoteControlValues() {
		this.props.remoteControlValues.pid_control.throttle = 0
		this.props.remoteControlValues.pid_control.rudder = 0
		this.setState({ throttleDirection: "", rudderDirection: "" })
	}

	adjustThrottleResponse(value: number) {
		// Raise the absolute value of the input value to the third power
		// For the rudder response then applying the sign back
		const input = Math.abs(value)
		const output = input ** 3
		const sign = Math.sign(value)
		const rudderAdjustValue = sign * output * 100

		return rudderAdjustValue
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
		  })

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
									borderColor: "red"
									},
									"&.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
									borderColor: "blue"
									},
									"&.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
									borderColor: "green"
									}
								}}
							/>
						}
					>
						<MenuItem key={1} value={"Manual Dual"}>Manual Dual</MenuItem>
						<MenuItem key={2} value={"Manual Single"}>Manual Single</MenuItem>
					</Select>
				</ThemeProvider>
			</div>
		)

		let leftController: ReactElement
		let rightController: ReactElement
		let soleController: ReactElement

		leftController = (
			<div className="controller">
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
		)

		rightController = (
			<div className={`controller ${this.state.controlType === "Manual Single" ? "hide-controller" : ""}`}>
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
		)

		soleController = (
			<div className="controller">
				<Joystick
					baseColor="white" 
					stickColor="black"
					size={100}
					throttle={100}
					start={() => {
						if(!this.props.weHaveInterval()) {
							this.props.createInterval();
						}
					}}
					move={(e: IJoystickUpdateEvent) => this.moveSoloController(e) }
					stop={() => this.clearRemoteControlValues()}
				/>
			</div>
		)

		// Set the remoteControlValues to the selected bot id
		this.props.remoteControlValues.bot_id = this.props.bot.bot_id

		return (
			<div id="remoteControlPanelContainer">
				
				<div className="rc-heading">Remote Control Panel: Bot {this.props.bot.bot_id}</div>

				<div className="stick-container">

					{this.state.controlType === "Manual Dual" ? leftController : soleController}

					<div className="rc-labels-container">
						{selectControlType}
						<div className="rc-info-container" >
							<div>Throttle Direction:</div>
							<div className="rc-data">{this.state.throttleDirection}</div>
							<div>Throttle:</div>
							<div className="rc-data">{this.props.remoteControlValues.pid_control.throttle.toFixed(0)}</div>
						</div>
						<div className="rc-info-container">
							<div>Rudder Direction:</div>
							<div className="rc-data">{this.state.rudderDirection}</div>	
							<div>Rudder:</div>					
							<div className="rc-data">{this.props.remoteControlValues.pid_control.rudder.toFixed(0)}</div>
						</div>
					</div>

					{rightController}

					<Gamepad
						deadZone={0.2}
						onConnect={() => {
							console.log("connected");
						}}
						onAxisChange={(axisName: string, value: number) => {
							this.props.createInterval();
							let rudderAdjustValue = this.adjustThrottleResponse(value);
							this.handleGamepadAxisChange(axisName, rudderAdjustValue, value)
						}}
					>
						<React.Fragment />
					</Gamepad>
				</div>
			</div>
		);
    }
}

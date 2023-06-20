import React from 'react'
import {JaiaAPI} from '../../common/JaiaAPI'
import { Joystick, JoystickShape } from 'react-joystick-component'
import { Engineering } from './shared/JAIAProtobuf'
import { PortalBotStatus } from './shared/PortalStatus'
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import OutlinedInput from '@mui/material/OutlinedInput';
import Gamepad from 'react-gamepad';
import { createTheme, ThemeProvider } from '@mui/material/styles';

interface Props {
	api: JaiaAPI,
	bot: PortalBotStatus,
	createInterval: () => void,
	clearInterval: () => void,
	remoteControlValues: Engineering,
	weAreInControl: () => boolean,
	weHaveInterval: () => boolean
}

interface State {
	isJoyStickStart: boolean,
	throttleDirection: string,
	rudderDirection: string,
	controlType: string,
	botStateShow: RegExp,
	panelHeight: string
	rcMode: boolean
}

export default class RCControllerPanel extends React.Component {
	api: JaiaAPI
	props: Props
	state: State

    constructor(props: Props) {
        super(props)
        this.api = props.api

        this.state = {
			isJoyStickStart: false,
			throttleDirection: '',
			rudderDirection: '',
			controlType: "Manual Dual",
			botStateShow: /^IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL.+$/,
			panelHeight: "0px",
			rcMode: false
        }
    }

    render() {
		let self = this;

		// Set bot id
		self.props.remoteControlValues.bot_id = self.props.bot.bot_id;

		// Take 40 % of the event distance provides 
		// This means our max forward throttle would be 40 or 2 m/s.
		let limitForwardThrottle = 0.4; 
		// Take 10 % of the event distance provides 
		// This means our max backward throttle would be 10 or 0.5 m/s.
		let limitBackwardThrottle = 0.1;

		if (self.state.botStateShow.test(self.props.bot.mission_state) && self.props.weAreInControl()) {
			self.state.panelHeight = ""
			self.state.rcMode = true;
		} else {
			self.state.panelHeight = "0px"
			self.state.rcMode = false;
		}

		if (!self.state.rcMode) {
			self.props.clearInterval();
		}

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
						value={self.state.controlType}
						label="Assign"
						onChange={self.controlChange}
						sx={{ color: 'white', fontSize: '1.25rem' }}
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

		let leftController = null;
		let rightController = null;
		let soleController = null;

		leftController = (
			<div className="controller">
				<Joystick
					baseColor="white" 
					stickColor="black"
					controlPlaneShape={JoystickShape.AxisY}
					size={100}
					throttle={100}
					start={(e) => {
						if(!self.props.weHaveInterval()) {
							self.props.createInterval();
						}
					}}
					move={(e) => { 
						self.state.throttleDirection = e.direction.toString();

						if(e.direction.toString() == "FORWARD") {
							self.props.remoteControlValues.pid_control.throttle = (e.y * 100) * limitForwardThrottle;
						} else if(e.direction.toString() == "BACKWARD")
						{
							self.props.remoteControlValues.pid_control.throttle = (e.y * 100) * limitBackwardThrottle;
						}
					}}
					stop={(e) => { 
						self.props.remoteControlValues.pid_control.throttle = 0;
						self.state.throttleDirection = "";
					}}
				/>
			</div>
		)

		rightController = (
			<div className={`controller ${this.state.controlType === "Manual Single" ? "hide-controller" : ""}`}>
				<Joystick
					baseColor="white" 
					stickColor="black"
					controlPlaneShape={JoystickShape.AxisX}
					size={100}
					throttle={100}
					start={(e) => {
						if(!self.props.weHaveInterval()) {
							self.props.createInterval();
						}
					}}
					move={(e) => { 
						let rudder_adjust_value = this.adjustThrottleResponse(e.x);

						self.state.rudderDirection = e.direction.toString();
						self.props.remoteControlValues.pid_control.rudder = rudder_adjust_value;
					}}
					stop={(e) => {
						self.props.remoteControlValues.pid_control.rudder = 0; 
						self.state.rudderDirection = "";
					}}
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
					start={(e) => {
						if(!self.props.weHaveInterval()) {
							self.props.createInterval();
						}
					}}
					move={(e) => { 
						let rudder_adjust_value = this.adjustThrottleResponse(e.x);

						if(e.y >= 0) {
							self.props.remoteControlValues.pid_control.throttle = (e.y * 100) * limitForwardThrottle;
							self.state.throttleDirection = "FORWARD";
						} else if(e.y < 0) {
							self.props.remoteControlValues.pid_control.throttle = (e.y * 100) * limitBackwardThrottle;
							self.state.throttleDirection = "BACKWARD";
						}

						self.props.remoteControlValues.pid_control.rudder = rudder_adjust_value;

						if(e.x >= 0) {
							self.state.rudderDirection = "RIGHT";
						} else if(e.x < 0) {
							self.state.rudderDirection = "LEFT";
						}
					}}
					stop={(e) => { 
						self.clearRemoteControlValues();
					}}
				/>
			</div>
		)

		return (
			<div id="remoteControlPanelContainer" style={{height: this.state.panelHeight}}>
				
				<div className="rc-heading">Remote Control Panel: Bot {self.props.bot.bot_id}</div>

				<div className="stick-container">

					{this.state.controlType === 'Manual Dual' ? leftController : soleController}

					<div className="rc-labels-container">
						{selectControlType}
						<div className="rc-info-container" >
							<div>Throttle Direction:</div>
							<div className="rc-data">{self.state.throttleDirection}</div>
							<div>Throttle:</div>
							<div className="rc-data">{self.props.remoteControlValues.pid_control.throttle.toFixed(0)}</div>
						</div>
						<div className="rc-info-container">
							<div>Rudder Direction:</div>
							<div className="rc-data">{self.state.rudderDirection}</div>	
							<div>Rudder:</div>					
							<div className="rc-data">{self.props.remoteControlValues.pid_control.rudder.toFixed(0)}</div>
						</div>
					</div>

					{rightController}

					<Gamepad
						deadZone={0.2}
						onConnect={() => {
							console.log("connected");
						}}
						onAxisChange={(axisName: string, value: number, previousValue: number) => {
							if(!self.props.weHaveInterval() && self.state.rcMode) {
								self.props.createInterval();
							}

							let rudder_adjust_value = this.adjustThrottleResponse(value);

							if(self.state.controlType == "Manual Single") {
								
								if(axisName == "LeftStickX") {
									self.props.remoteControlValues.pid_control.rudder = rudder_adjust_value;
									if(value > 0) {
										self.state.rudderDirection = "RIGHT";
									} else if(value < 0) {
										self.state.rudderDirection = "LEFT";
									} else if(value == 0) {
										self.props.remoteControlValues.pid_control.rudder = 0;
										self.state.rudderDirection = "";
									}
								} 
								
								if(axisName == "LeftStickY") {	
									if(value > 0) {
										self.props.remoteControlValues.pid_control.throttle = (value * 100) * limitForwardThrottle;
										self.state.throttleDirection = "FORWARD";
									} else if(value < 0) {
										self.props.remoteControlValues.pid_control.throttle = (value * 100) * limitBackwardThrottle;
										self.state.throttleDirection = "BACKWARD";
									} else if(value == 0) {
										self.props.remoteControlValues.pid_control.throttle = 0;
										self.state.throttleDirection = "";
									}
								}
							} else if(self.state.controlType == "Manual Dual") {
								if(axisName == "LeftStickY") {
									if(value > 0) {
										self.props.remoteControlValues.pid_control.throttle = (value * 100) * limitForwardThrottle;
										self.state.throttleDirection = "FORWARD";
									} else if(value < 0) {
										self.props.remoteControlValues.pid_control.throttle = (value * 100) * limitBackwardThrottle;
										self.state.throttleDirection = "BACKWARD";
									} else if(value == 0) {
										self.props.remoteControlValues.pid_control.throttle = 0;
										self.state.throttleDirection = "";
									}
								}

								if(axisName == "RightStickX") {
									self.props.remoteControlValues.pid_control.rudder = rudder_adjust_value;
									if(value > 0) {
										self.state.rudderDirection = "RIGHT";
									} else if(value < 0) {
										self.state.rudderDirection = "LEFT";
									} else if(value == 0) {
										self.props.remoteControlValues.pid_control.rudder = 0;
										self.state.rudderDirection = "";
									}
								}
							}
						}}
					>
						<React.Fragment />
					</Gamepad>
				</div>
			</div>
		);
    }

	controlChange = (event: SelectChangeEvent) => {
		this.state.controlType = event.target.value;
	};

	clearRemoteControlValues() {
		this.props.remoteControlValues.pid_control.throttle = 0;
		this.props.remoteControlValues.pid_control.rudder = 0;
		this.state.throttleDirection = "";
		this.state.rudderDirection = "";
	}

	adjustThrottleResponse(value: number) {
		// Raise the absolute value of the input value to the third power
		// For the rudder response then applying the sign back
		const input = Math.abs(value);
		const output = input ** 3;
		const sign = Math.sign(value);
		const rudder_adjust_value = sign * output * 100;

		return rudder_adjust_value;
	}
}

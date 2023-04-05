import React from 'react'
import {JaiaAPI} from '../../common/JaiaAPI'
import { Joystick, JoystickShape } from 'react-joystick-component'
import { Engineering } from './gui/JAIAProtobuf'
import { PortalBotStatus } from './PortalStatus'
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';

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
			controlType: "Manual Single",
			botStateShow: /^IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL.+$/,
			panelHeight: "0px",
			rcMode: false
        }
    }

    render() {
		let self = this;

		// Set bot id
		self.props.remoteControlValues.bot_id = self.props.bot.bot_id;

		if (self.state.botStateShow.test(self.props.bot.mission_state)
			&& self.props.weAreInControl()) {
			self.state.panelHeight = "20vh"
			self.state.rcMode = true;
		} else {
			self.state.panelHeight = "0px"
			self.state.rcMode = false;
		}

		if(!self.state.rcMode) {
			self.props.clearInterval();
		}

		// Create the Select Object
        let selectControlType =
            <Box sx={{ minWidth: 120 }}>
                <FormControl fullWidth>
                <InputLabel id="control-type-select-label">Control</InputLabel>
                    <Select
                        labelId="control-type-select-label"
                        id="control-type-select"
                        value={self.state.controlType}
                        label="Assign"
                        onChange={self.controlChange}
                    >
						<MenuItem key={1} value={"Manual Single"}>Manual Single</MenuItem>
						<MenuItem key={2} value={"Manual Dual"}>Manual Dual</MenuItem>
						{/*<MenuItem key={3} value={"Heading Dual"}>Heading Dual</MenuItem>*/}
                    </Select>
                </FormControl>
            </Box>

		let controller = null;

		if(self.state.controlType == "Manual Dual") {
			controller = 
				<React.Fragment>
					<div style={{ zIndex: 100, position: 'absolute', top: '7vh', left: '14vw' }}>
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
								// Take 40 % of the event distance provides 
								// This means our max forward throttle would be 40 or 2 m/s.
								let limitForwardThrottle = 0.4; 
								// Take 10 % of the event distance provides 
								// This means our max backward throttle would be 10 or 0.5 m/s.
								let limitBackwardThrottle = 0.1;

								self.state.throttleDirection = e.direction.toString();

								if(e.direction.toString() == "FORWARD") {
									self.props.remoteControlValues.pid_control.throttle = e.distance * limitForwardThrottle;
								} else if(e.direction.toString() == "BACKWARD")
								{
									self.props.remoteControlValues.pid_control.throttle = e.distance * limitBackwardThrottle * -1;
								}
							}}
							stop={(e) => { 
								self.props.remoteControlValues.pid_control.throttle = 0;
								self.state.throttleDirection = "";
							}}
						/>
					</div>
				
					<div style={{ zIndex: 100, position: 'absolute', top: '7vh', right: '10vw' }}>
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
								self.state.rudderDirection = e.direction.toString();

								self.props.remoteControlValues.pid_control.rudder = e.distance;
								if(e.direction.toString() == "LEFT") {
									self.props.remoteControlValues.pid_control.rudder *= -1;
								}
							}}
							stop={(e) => {
								self.props.remoteControlValues.pid_control.rudder = 0; 
								self.state.rudderDirection = "";
							}}
						/>
					</div>
				</React.Fragment>
		} else if(self.state.controlType == "Manual Single") {
			controller = 
					<div style={{ zIndex: 100, position: 'absolute', top: '7vh', left: '14vw' }}>
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
								// Take 40 % of the event distance provides 
								// This means our max forward throttle would be 40 or 2 m/s.
								let limitForwardThrottle = 0.4; 
								// Take 10 % of the event distance provides 
								// This means our max backward throttle would be 10 or 0.5 m/s.
								let limitBackwardThrottle = 0.1;

								if(e.y >= 0) {
									self.props.remoteControlValues.pid_control.throttle = (e.y * 100) * limitForwardThrottle;
									self.state.throttleDirection = "FORWARD";
								} else if(e.y < 0) {
									self.props.remoteControlValues.pid_control.throttle = (e.y * 100) * limitBackwardThrottle;
									self.state.throttleDirection = "BACKWARD";
								}

								self.props.remoteControlValues.pid_control.rudder = (e.x * 100);

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
		}

		return (
			<React.Fragment>
				<div id="remoteControlPanel"
					style={{height: self.state.panelHeight}}
				>
					<div className="panel" >
						<b>Remote Control Panel: Bot {self.props.bot.bot_id}</b><br />						
					</div>
					<div style={{ zIndex: 100, position: 'absolute', top: '3vh', left: '42vw' }}>
						<div className="panel" >
							{selectControlType}
						</div>
					</div>
					<div id="sticks">
						<div style={{ zIndex: 100, position: 'absolute', top: '9vh', left: '42vw', width: '350px' }}>
							<div className="panel" >
								<b>Throttle Direction: {self.state.throttleDirection}</b>
								<br />
								<b>Throttle: {self.props.remoteControlValues.pid_control.throttle.toFixed(0)}</b>						
							</div>
						</div>
						<div style={{ zIndex: 100, position: 'absolute', top: '14vh', left: '42vw', width: '350px' }}>
							<div className="panel" >
								<b>Rudder Direction: {self.state.rudderDirection}</b>
								<br />
								<b>Rudder: {self.props.remoteControlValues.pid_control.rudder.toFixed(0)}</b>						
							</div>
						</div>
						{controller}
					</div>
				</div>
			</React.Fragment>
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

}
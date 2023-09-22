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
	weAreInControl: () => boolean,
	weHaveInterval: () => boolean
}

interface State {
	controlType: string,
	isJoyStickStart: boolean,
	joyStickStatus: { [joyStick: string]: boolean },
	throttleDirection: string,
	rudderDirection: string,
	throttleBinNumber: number,
	rudderBinNumber: number,
}

enum JoySticks {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
	SOLE = 'SOLE'
}

enum ControlTypes {
	MANUAL_DUAL = 'MANUAL_DUAL',
	MANUAL_SINGLE = 'MANUAL_SINGLE',
	DIVE = 'DIVE'
}

export default class RCControllerPanel extends React.Component {
	api: JaiaAPI
	props: Props
	state: State

    constructor(props: Props) {
        super(props)
        this.api = props.api

        this.state = {
			controlType: ControlTypes.MANUAL_DUAL,
			isJoyStickStart: false,
			joyStickStatus: {
				'left': true,
				'right': true,
				'sole': false
			},
			throttleDirection: '',
			rudderDirection: '',
			throttleBinNumber: 0,
			rudderBinNumber: 0
        }
    }

	updateThrottleDirectionMove(event: IJoystickUpdateEvent) {
		let bin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}
		if (event.direction.toString() === 'FORWARD') {
			this.calcThrottleBinNum((event.y * 100), 'FORWARD', bin)
			this.props.remoteControlValues.pid_control.throttle = bin.binValue
		} else if (event.direction.toString() === 'BACKWARD') {
			this.calcThrottleBinNum((event.y * 100), 'BACKWARD', bin)
			this.props.remoteControlValues.pid_control.throttle = bin.binValue
		}
		this.setState({ throttleDirection: event.direction.toString(), throttleBinNumber: bin.binNumber }, () => {})		
	}

	calcThrottleBinNum(speed: number, throttleDirection: string, bin: {binNumber: number, binValue: number}) {
		// Basic error handling to protect against unexpected speed value
		if (!speed || speed === 0) {
			return 0
		}

		if (throttleDirection === 'FORWARD') {
			// This means our max forward throttle would be 40 or 2 m/s.
			if (speed <= 95) {
				bin.binNumber = 1
				bin.binValue = 20
			} else if (speed > 95) {
				bin.binNumber = 2
				bin.binValue = 40
			}
		} else if (throttleDirection === 'BACKWARD') {
			// This means our max backward throttle would be 10 or 0.5 m/s.
			bin.binNumber = 1
			bin.binValue = -10
		}
	}

	updateThrottleDirectionStop() {
		this.props.remoteControlValues.pid_control.throttle = 0
		this.setState({ throttleDirection: '', throttleBinNumber: 0 })
	}

	updateRudderDirectionMove(event: IJoystickUpdateEvent) {
		let bin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}
		this.calcRudderBinNum((event.x * 100), bin)
		this.props.remoteControlValues.pid_control.rudder = bin.binValue
		this.setState({ rudderDirection: event.direction.toString(), rudderBinNumber: bin.binNumber })
	}

	calcRudderBinNum(position: number, bin: {binNumber: number, binValue: number}) {
		// Basic error handling to protect against unexpected position value
		if (!position) {
			return
		}
		
		// Added a deadzone
		if (position > 10 && position < 50) {
			bin.binNumber = 1
			bin.binValue = 40
		} else if (position >= 50 && position <= 95) {
			bin.binNumber = 2
			bin.binValue = 70
		} else if (position > 95) {
			bin.binNumber = 3
			bin.binValue = 100
		} else if (position < -10 && position > -50) {
			bin.binNumber = 1
			bin.binValue = -40
		} else if (position <= -50 && position >= -95) {
			bin.binNumber = 2
			bin.binValue = -70
		} else if (position < -95) {
			bin.binNumber = 3
			bin.binValue = -100
		}
	}

	updateRudderDirectionStop() {
		this.props.remoteControlValues.pid_control.rudder = 0
		this.setState({ rudderDirection: '', rudderBinNumber: 0 })
	}

	moveSoloController(event: IJoystickUpdateEvent) {
		let throttleDirection = ''
		let rudderDirection = ''
		let throttleBinNumber = 0
		let rudderBinNumber = 0

		let thottleBin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}
		let rudderBin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}

		if (event.y > 0) {
			throttleDirection = 'FORWARD'
		} else if (event.y < 0) {
			throttleDirection = 'BACKWARD'
		}

		// Added a deadzone
		if ((event.x * 100) > 10) {
			rudderDirection = 'RIGHT'
		} else if ((event.x * 100) < -10) {
		    rudderDirection = 'LEFT'
		}

		this.calcThrottleBinNum((event.y * 100), throttleDirection, thottleBin)
		this.props.remoteControlValues.pid_control.throttle = thottleBin.binValue
		throttleBinNumber = thottleBin.binNumber

		this.calcRudderBinNum((event.x * 100), rudderBin)
		this.props.remoteControlValues.pid_control.rudder = rudderBin.binValue
		rudderBinNumber = rudderBin.binNumber


		this.setState({ 
			throttleDirection, 
			rudderDirection,
			throttleBinNumber,
			rudderBinNumber
		})
	}

	handleGamepadAxisChange(axisName: string, value: number) {
		const controlType = this.state.controlType

		let throttleDirection = ''
		let rudderDirection = ''
		let throttleBinNumber = 0
		let rudderBinNumber = 0

		if (axisName === (controlType === ControlTypes.MANUAL_SINGLE ? 'LeftStickX' : 'RightStickX')) {
			let bin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}
			this.calcRudderBinNum((value * 100), bin)
			this.props.remoteControlValues.pid_control.rudder = bin.binValue
			// Added a deadzone
			if (value > 10) {
				rudderDirection = 'RIGHT'
			} else if (value < -10) {
				rudderDirection = 'LEFT'
			} else if (value === 0) {
				rudderDirection = ''
				this.props.remoteControlValues.pid_control.rudder = 0
			}
			rudderBinNumber = bin.binNumber
		} 
		
		if (axisName === 'LeftStickY') {	
			let bin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}
			if (value > 0) {
				throttleDirection = 'FORWARD'
				this.calcThrottleBinNum((value * 100), throttleDirection, bin)
				this.props.remoteControlValues.pid_control.throttle = bin.binValue
			} else if (value < 0) {
				throttleDirection = 'BACKWARD'
				this.calcThrottleBinNum((value * 100), throttleDirection, bin)
				this.props.remoteControlValues.pid_control.throttle = bin.binValue
			} else if(value === 0) {
				throttleDirection = ''
				this.props.remoteControlValues.pid_control.throttle = 0
			}
			throttleBinNumber = bin.binNumber
		}

		if (throttleDirection) {
			this.setState({ throttleDirection, throttleBinNumber })
		}

		if (rudderDirection) {
			this.setState({ rudderDirection, rudderBinNumber })
		}

		if (!throttleDirection && !rudderDirection) {
			this.setState({ 
				throttleDirection, 
				rudderDirection,
				throttleBinNumber,
				rudderBinNumber
			})
		}
	}

	controlChange(event: SelectChangeEvent) {
		const controlType = (event.target.value).toUpperCase()
		if (controlType === ControlTypes.MANUAL_SINGLE) {
			this.setJoyStickStatus([JoySticks.SOLE])
		} else if (controlType === ControlTypes.MANUAL_DUAL) {
			this.setJoyStickStatus([JoySticks.LEFT, JoySticks.RIGHT])
		} else if (controlType === ControlTypes.DIVE) {
			this.setJoyStickStatus([])
		}
		this.setState({ controlType })
	}

	setJoyStickStatus(joySticksOn: JoySticks[]) {
		const joyStickStatus = this.state.joyStickStatus
		for (const key of Object.keys(joyStickStatus)) {
			if (joySticksOn.includes(key.toUpperCase() as JoySticks)) {
				joyStickStatus[key] = true
			} else {
				joyStickStatus[key] = false
			}
		}
		this.setState({ joyStickStatus })
	}

	clearRemoteControlValues() {
		this.props.remoteControlValues.pid_control.throttle = 0
		this.props.remoteControlValues.pid_control.rudder = 0
		this.setState({ 
			throttleDirection: '', 
			rudderDirection: '',
			throttleBinNumber: 0,
			rudderBinNumber: 0
	 	})
	}

    render() {
		const theme = createTheme({
			components: {
			  MuiOutlinedInput: {
				styleOverrides: {
				  root: {
					'&:hover .MuiOutlinedInput-notchedOutline': {
					  borderColor: 'white',
					},
					'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
					  borderColor: 'white',
					},
				  },
				  notchedOutline: {
					borderColor: 'white',
					padding: '0px',
				  },
				},
			  },
			},
		  })

		// Create the Select Object
        let selectControlType = (
			<div className='rc-dropdown'>
				<div>Control:</div>
				<ThemeProvider theme={theme}>
					<Select
						labelId='control-type-select-label'
						id='control-type-select'
						value={this.state.controlType}
						label='Assign'
						onChange={(e: SelectChangeEvent) => this.controlChange(e)}
						sx={{ color: 'white', fontSize: '1.25rem' }}
						input={
							<OutlinedInput
								notched
								sx={{
									'&.MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
									borderColor: 'red'
									},
									'&.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
									borderColor: 'blue'
									},
									'&.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
									borderColor: 'green'
									}
								}}
							/>
						}
					>
						<MenuItem key={1} value={ControlTypes.MANUAL_DUAL}>Manual Dual</MenuItem>
						<MenuItem key={2} value={ControlTypes.MANUAL_SINGLE}>Manual Single</MenuItem>
						<MenuItem key={3} value={ControlTypes.DIVE}>Dive</MenuItem>
					</Select>
				</ThemeProvider>
			</div>
		)

		let leftController: ReactElement
		let rightController: ReactElement
		let soleController: ReactElement

		leftController = (
			<div className={`controller ${this.state.joyStickStatus['left'] ? "": "hide-controller"}`}>
				<div className="controller-title">Throttle</div>
				<Joystick
					baseColor='white' 
					stickColor='black'
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
			<div className={`controller ${this.state.joyStickStatus['right'] ? "": "hide-controller"}`}>
				<div className="controller-title">Rudder</div>
				<Joystick
					baseColor='white' 
					stickColor='black'
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
			<div className={`controller ${this.state.joyStickStatus['sole'] ? "": "hide-controller"}`}>
				<Joystick
					baseColor='white' 
					stickColor='black'
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
			<div id='remoteControlPanelContainer'>
				
				<div className='rc-heading'>Remote Control Panel: Bot {this.props.bot.bot_id}</div>

				<div className='stick-container'>

					{this.state.controlType === ControlTypes.MANUAL_DUAL ? leftController : soleController}

					<div className='rc-labels-container'>
						{selectControlType}
						<div className='rc-info-container' >
							<div>Throttle Direction:</div>
							<div className='rc-data'>{this.state.throttleDirection}</div>
							<div>Throttle:</div>
							<div className='rc-data'>{this.state.throttleBinNumber}</div>
						</div>
						<div className='rc-info-container'>
							<div>Rudder Direction:</div>
							<div className='rc-data'>{this.state.rudderDirection}</div>	
							<div>Rudder:</div>					
							<div className='rc-data'>{this.state.rudderBinNumber}</div>
						</div>
					</div>

					{rightController}

					<Gamepad
						deadZone={0.2}
						onConnect={() => {
							console.log('connected');
						}}
						onAxisChange={(axisName: string, value: number) => {
							this.props.createInterval();
							this.handleGamepadAxisChange(axisName, value)
						}}
					>
						<React.Fragment />
					</Gamepad>
				</div>
			</div>
		);
    }
}

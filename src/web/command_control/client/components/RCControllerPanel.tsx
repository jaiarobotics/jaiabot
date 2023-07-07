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
	throttleBinNumber: number,
	rudderBinNumber: number,
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

	maxForwardThrottle: number
	maxBackwardThrottle: number
	numberOfBins: number

    constructor(props: Props) {
        super(props)
        this.api = props.api
		this.maxForwardThrottle = this.limitForwardThrottle * 100
		this.maxBackwardThrottle = this.limitBackwardThrottle * 100
		this.numberOfBins = 3

        this.state = {
			isJoyStickStart: false,
			throttleDirection: '',
			rudderDirection: '',
			throttleBinNumber: 0,
			rudderBinNumber: 0,
			controlType: 'Manual Dual'
        }
    }

	updateThrottleDirectionMove(event: IJoystickUpdateEvent) {
		let binNumber = 0
		if (event.direction.toString() === 'FORWARD') {
			const throttleForwardAdjustValue = (event.y * 100) * this.limitForwardThrottle
			binNumber = this.calcThrottleBinNum(throttleForwardAdjustValue, 'FORWARD')
			this.props.remoteControlValues.pid_control.throttle = throttleForwardAdjustValue
		} else if (event.direction.toString() === 'BACKWARD') {
			const throttleBackwardAdjustValue = (event.y * 100) * this.limitBackwardThrottle
			binNumber = this.calcThrottleBinNum(throttleBackwardAdjustValue, 'BACKWARD')
			this.props.remoteControlValues.pid_control.throttle = throttleBackwardAdjustValue
		}
		this.setState({ throttleDirection: event.direction.toString(), throttleBinNumber: binNumber }, () => {})		
	}

	calcThrottleBinNum(speed: number, throttleDirection: string) {
		// Basic error handling to protect against unexpected speed value
		if (!speed || speed === 0) {
			return 0
		}

		let binNumber = 0
		if (throttleDirection === 'FORWARD') {
			const binBreakpointDivisor = Math.ceil(this.maxForwardThrottle / this.numberOfBins)
			binNumber = Math.round(Number((speed / binBreakpointDivisor).toFixed(1)))
		} else if (throttleDirection === 'BACKWARD') {
			const binBreakpointDivisor = Math.ceil((this.maxBackwardThrottle) / this.numberOfBins)
			// Speed is multiplied by (-1) to convert it to a positive value becasue 2.5 is rounded to 3; otherwise -2.5 gets rounded to -2
			binNumber = Math.round(Number(((speed * -1) / binBreakpointDivisor).toFixed(1))) * -1
		}
		return binNumber
	}

	updateThrottleDirectionStop() {
		this.props.remoteControlValues.pid_control.throttle = 0
		this.setState({ throttleDirection: '', throttleBinNumber: 0 })
	}

	updateRudderDirectionMove(event: IJoystickUpdateEvent) {
		const rudderAdjustValue = this.adjustThrottleResponse(event.x)
		const binNumber = this.calcRudderBinNum(rudderAdjustValue)
		this.props.remoteControlValues.pid_control.rudder = rudderAdjustValue
		this.setState({ rudderDirection: event.direction.toString(), rudderBinNumber: binNumber })
	}

	calcRudderBinNum(speed: number) {
		// Basic error handling to protect against unexpected speed value
		if (!speed || speed === 0) {
			return 0
		}

		const absMaxRudderSpeed = 100
		let binNumber = 0
		if (speed > 0) {
			const binBreakpointDivisor = Math.ceil(absMaxRudderSpeed / this.numberOfBins)
			binNumber = Math.round(Number((speed / binBreakpointDivisor).toFixed(1)))
		} else {
			const binBreakpointDivisor = Math.ceil((absMaxRudderSpeed) / this.numberOfBins)
			// Speed is multiplied by (-1) to convert it to a positive value becasue 2.5 is rounded to 3; otherwise -2.5 gets rounded to -2
			binNumber = Math.round(Number(((speed * -1) / binBreakpointDivisor).toFixed(1))) * -1
		}
		return binNumber
	}

	updateRudderDirectionStop() {
		this.props.remoteControlValues.pid_control.rudder = 0
		this.setState({ rudderDirection: '', rudderBinNumber: 0 })
	}

	moveSoloController(event: IJoystickUpdateEvent) {
		let rudderAdjustValue = this.adjustThrottleResponse(event.x)
		let throttleDirection = ''
		let rudderDirection = ''
		let throttleBinNumber = 0
		let rudderBinNumber = 0

		if (event.y >= 0) {
			const throttleForwardAdjustValue = (event.y * 100) * this.limitForwardThrottle
			this.props.remoteControlValues.pid_control.throttle = throttleForwardAdjustValue
			throttleBinNumber = this.calcThrottleBinNum(throttleForwardAdjustValue, 'FORWARD')
			throttleDirection = 'FORWARD'
		} else if (event.y < 0) {
			const throttleBackwardAdjustValue = (event.y * 100) * this.limitBackwardThrottle
			this.props.remoteControlValues.pid_control.throttle = throttleBackwardAdjustValue
			throttleBinNumber = this.calcThrottleBinNum(throttleBackwardAdjustValue, 'BACKWARD')
			throttleDirection = 'BACKWARD'
		}

		this.props.remoteControlValues.pid_control.rudder = rudderAdjustValue
		rudderBinNumber = this.calcRudderBinNum(rudderAdjustValue)

		if (event.x >= 0) {
			rudderDirection = 'RIGHT'
		} else if (event.x < 0) {
		    rudderDirection = 'LEFT'
		}

		this.setState({ 
			throttleDirection, 
			rudderDirection,
			throttleBinNumber,
			rudderBinNumber
		})
	}

	handleGamepadAxisChange(axisName: string, rudderAdjustValue: number, value: number) {
		const controlType = this.state.controlType
		let throttleDirection = ''
		let rudderDirection = ''

		if (axisName === (controlType === 'Manual Single' ? 'LeftStickX' : 'RightStickX')) {
			this.props.remoteControlValues.pid_control.rudder = rudderAdjustValue
			if (value > 0) {
				rudderDirection = 'RIGHT'
			} else if (value < 0) {
				rudderDirection = 'LEFT'
			} else if (value === 0) {
				rudderDirection = ''
				this.props.remoteControlValues.pid_control.rudder = 0
			}
		} 
		
		if (axisName === 'LeftStickY') {	
			if (value > 0) {
				throttleDirection = 'FORWARD'
				this.props.remoteControlValues.pid_control.throttle = (value * 100) * this.limitForwardThrottle
			} else if (value < 0) {
				throttleDirection = 'BACKWARD'
				this.props.remoteControlValues.pid_control.throttle = (value * 100) * this.limitBackwardThrottle
			} else if(value === 0) {
				throttleDirection = ''
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
		this.setState({ controlType: event.target.value })
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
						<MenuItem key={1} value={'Manual Dual'}>Manual Dual</MenuItem>
						<MenuItem key={2} value={'Manual Single'}>Manual Single</MenuItem>
					</Select>
				</ThemeProvider>
			</div>
		)

		let leftController: ReactElement
		let rightController: ReactElement
		let soleController: ReactElement

		leftController = (
			<div className='controller'>
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
			<div className={`controller ${this.state.controlType === 'Manual Single' ? 'hide-controller' : ''}`}>
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
			<div className='controller'>
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

					{this.state.controlType === 'Manual Dual' ? leftController : soleController}

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

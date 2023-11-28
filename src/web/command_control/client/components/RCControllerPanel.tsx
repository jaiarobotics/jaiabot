import React, { ReactElement } from 'react'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import Button from '@mui/material/Button'
import Gamepad from 'react-gamepad'
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput'
import { Icon } from '@mdi/react'
import { error, success } from '../libs/notifications'
import { mdiPlay } from '@mdi/js'
import { JaiaAPI } from '../../common/JaiaAPI'
import { Engineering } from './shared/JAIAProtobuf'
import { PortalBotStatus } from './shared/PortalStatus'
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick'
import { TaskType, CommandType } from './shared/JAIAProtobuf'
import { Joystick, JoystickShape } from 'react-joystick-component'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { CustomAlert } from './shared/CustomAlert';

interface Props {
	api: JaiaAPI,
	bot: PortalBotStatus,
	isRCModeActive: boolean,
	remoteControlValues: Engineering,
	rcDiveParameters: { [diveParam: string]: string },
	createInterval: () => void,
	weAreInControl: () => boolean,
	weHaveInterval: () => boolean,
	setRCDiveParameters: (diveParams: {[param: string]: string} ) => void,
	initRCDivesStorage: (botId: number) => void
}

interface State {
	controlType: string,
	isJoyStickStart: boolean,
	joyStickStatus: { [joyStick: string]: boolean },
	throttleDirection: string,
	rudderDirection: string,
	throttleBinNumber: number,
	rudderBinNumber: number,
	botId: number
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

        // Check to see if rc dive parameters are
        // saved in local storage
        if (props.rcDiveParameters === undefined) {
            props.initRCDivesStorage(props.bot.bot_id)
        }

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
			rudderBinNumber: 0,
			// bot id is saved to determine when the user
			// clicks on a new bot details window
			botId: 0
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

	/**
	 * Creates the bins for throttle that are used as output for the operator
	 * 
	 * @param {number} speed is the position of the input that is used to determine bin number
	 * @param {string} throttleDirection determines the direction of the throttle (FORWARD, BACKWARD)
	 * @param {{binNumber: number, binValue: number}} bin used to pass the bin number and value
	 * @returns {number}
	 * 
	 * @notes
	 * Need template for object parameters
	 */
	calcThrottleBinNum(speed: number, throttleDirection: string, bin: {binNumber: number, binValue: number}) {
		// Basic error handling to protect against unexpected speed value
		if (!speed || speed === 0) {
			return 0
		}

		if (throttleDirection === 'FORWARD') {
			// This means our max forward throttle would be 40 or speed 2.
			if (speed <= 95) {
				bin.binNumber = 1
				bin.binValue = 20
			} else if (speed > 95) {
				bin.binNumber = 2
				bin.binValue = 40
			}
		} else if (throttleDirection === 'BACKWARD') {
			// This means our max backward throttle would be 10 or speed 0.5.
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
		// The is used to only detect changes if the value is above
		// this percentage (Added when using tablet controller)
		let deadzonePercent = 10
		this.calcRudderBinNum((event.x * 100), bin, deadzonePercent)
		this.props.remoteControlValues.pid_control.rudder = bin.binValue
		this.setState({ rudderDirection: event.direction.toString(), rudderBinNumber: bin.binNumber })
	}

	calcRudderBinNum(position: number, bin: {binNumber: number, binValue: number}, deadzonePercent: number) {
		// Basic error handling to protect against unexpected position value
		if (!position) {
			return
		}
		
		// Added a deadzone
		if (position > deadzonePercent && position < 50) {
			bin.binNumber = 1
			bin.binValue = 40
		} else if (position >= 50 && position <= 95) {
			bin.binNumber = 2
			bin.binValue = 70
		} else if (position > 95) {
			bin.binNumber = 3
			bin.binValue = 100
		} else if (position < -deadzonePercent && position > -50) {
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

		// The is used to only detect changes if the value is above
		// this percentage (Added when using tablet controller)
		let deadzonePercent = 10

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

		this.calcRudderBinNum((event.x * 100), rudderBin, deadzonePercent)
		this.props.remoteControlValues.pid_control.rudder = rudderBin.binValue
		rudderBinNumber = rudderBin.binNumber


		this.setState({ 
			throttleDirection, 
			rudderDirection,
			throttleBinNumber,
			rudderBinNumber
		})
	}

	/**
	 * This handles the input from the xbox controller by mapping the value
	 * of the inputs to a bin number and direction to give the user feedback
	 * @param axisName string - indicates the analog stick that is being controlled
	 * @param value number - indicates the position of the analog stick
	 */
	handleGamepadAxisChange(axisName: string, value: number) {
		const controlType = this.state.controlType

		let throttleDirection = this.state.throttleDirection
		let rudderDirection = this.state.rudderDirection
		let throttleBinNumber = this.state.throttleBinNumber
		let rudderBinNumber = this.state.rudderBinNumber

		let valuePercent = (value * 100)

		// The is used to only detect changes if the value is above
		// this percentage (Added when using xbox controller)
		let deadzonePercent = 15

		// Rudder Handler
		if (axisName === (controlType === ControlTypes.MANUAL_SINGLE ? 'LeftStickX' : 'RightStickX')) {
			let bin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}

			this.calcRudderBinNum(valuePercent, bin, deadzonePercent)
			this.props.remoteControlValues.pid_control.rudder = bin.binValue
			rudderBinNumber = bin.binNumber

			// Added a deadzone
			if (valuePercent > deadzonePercent) {
				rudderDirection = 'RIGHT'
			} else if (valuePercent < -deadzonePercent) {
				rudderDirection = 'LEFT'
			} else {
				rudderDirection = ''
				this.props.remoteControlValues.pid_control.rudder = 0
				rudderBinNumber = 0
			}
			this.setState({ 
				rudderDirection,
				rudderBinNumber
			})
		} 
		
		// Throttle Handler
		if (axisName === 'LeftStickY') {	
			let bin: {binNumber: number, binValue: number} = {binNumber: 0, binValue: 0}
			// Added a deadzone
			if (valuePercent > deadzonePercent) {
				throttleDirection = 'FORWARD'
				this.calcThrottleBinNum(valuePercent, throttleDirection, bin)
				this.props.remoteControlValues.pid_control.throttle = bin.binValue
				throttleBinNumber = bin.binNumber
			} else if (valuePercent < -deadzonePercent) {
				throttleDirection = 'BACKWARD'
				this.calcThrottleBinNum(valuePercent, throttleDirection, bin)
				this.props.remoteControlValues.pid_control.throttle = bin.binValue
				throttleBinNumber = bin.binNumber
			} else {
				throttleDirection = ''
				this.props.remoteControlValues.pid_control.throttle = 0
				throttleBinNumber = 0
			}
			this.setState({ 
				throttleDirection, 
				throttleBinNumber
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

	handleTaskParamInputChange(evt: React.ChangeEvent<HTMLInputElement>) {
		const input = evt.target.value
		const paramType = evt.target.id
		const diveParams = {...this.props.rcDiveParameters}

		if (Number.isNaN(Number(input)) || Number(input) < 0) {
			CustomAlert.alert('Please enter only positive numbers for dive parameters')
			return
		}
		
		diveParams[paramType] = input
		this.props.setRCDiveParameters(diveParams)
	}

	handleDiveButtonClick() {
		const diveParametersNum: { [diveParam: string]: number } = {}
		const driftParametersNum: { [driftParam: string]: number } = {}

		for (const key of Object.keys(this.props.rcDiveParameters)) {
			if (key === 'driftTime') {
				driftParametersNum[key] = Number(this.props.rcDiveParameters[key])
			} else {
				diveParametersNum[key] = Number(this.props.rcDiveParameters[key])
			}
		}

		const rcDiveCommand = {
			bot_id: this.props.bot?.bot_id,
			type: CommandType.REMOTE_CONTROL_TASK,
			rc_task: {
				type: TaskType.DIVE,
				dive: diveParametersNum,
				surface_drift: driftParametersNum
			}
		}

		this.api.postCommand(rcDiveCommand).then(response => {
			if (response.message) {
				error('Unable to post RC dive command')
			} else {
				success('Beginning RC dive')
			}
		})
	}

	isDiveButtonDisabled() {
		for (const value of Object.values(this.props.rcDiveParameters)) {
			if (value === '') {
				return true
			}
		}
		return false
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
		let driveControlPad: ReactElement
		let diveControlPad: ReactElement

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

		driveControlPad = (
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
		)

		if (this.props?.rcDiveParameters !== undefined) {
			diveControlPad = (
				<div className='rc-dive-labels-container'>
					<div className='rc-labels-left'>
						{selectControlType}
						<div className='rc-dive-info-container' >
							<div>Max Depth:</div>
							<input id='maxDepth' className='rc-input' type='text' value={this.props.rcDiveParameters?.maxDepth} onChange={(evt: React.ChangeEvent<HTMLInputElement>) => this.handleTaskParamInputChange(evt)} autoComplete='off'/>
							<div>m</div>

							<div>Depth Interval:</div>
							<input id='depthInterval' className='rc-input' type='text' value={this.props.rcDiveParameters?.depthInterval} onChange={(evt: React.ChangeEvent<HTMLInputElement>) => this.handleTaskParamInputChange(evt)} autoComplete='off' />
							<div>m</div>

							<div>Hold Time:</div>
							<input id='holdTime' className='rc-input' type='text' value={this.props.rcDiveParameters?.holdTime} onChange={(evt: React.ChangeEvent<HTMLInputElement>) => this.handleTaskParamInputChange(evt)} autoComplete='off'/>
							<div>s</div>

							<div>Drift Time:</div>
							<input id='driftTime' className='rc-input' type='text' value={this.props.rcDiveParameters?.driftTime} onChange={(evt: React.ChangeEvent<HTMLInputElement>) => this.handleTaskParamInputChange(evt)} autoComplete='off' />
							<div>s</div>
						</div>
					</div>
					<div className='rc-labels-right'>
						<Button
							className={`button-jcc button-rc-dive ${this.isDiveButtonDisabled() ? 'inactive' : ''}`}
							disabled={this.isDiveButtonDisabled()} 
							onClick={() => this.handleDiveButtonClick()}
						>
							<Icon path={mdiPlay} title='Run Mission'/>
						</Button>
					</div>
				</div>
			)
		}

		if (this.props?.bot?.bot_id !== undefined) {
			// Set the remoteControlValues to the selected bot id
			this.props.remoteControlValues.bot_id = this.props.bot.bot_id
		}

		return (
			<div id='remoteControlPanelContainer'>
				
				<div className='rc-heading'>Remote Control Panel: Bot {this.props.bot.bot_id}</div>

				<div className='stick-container'>
					{this.state.controlType === ControlTypes.MANUAL_DUAL ? leftController : soleController}

					{this.state.controlType === ControlTypes.DIVE ? diveControlPad : driveControlPad}

					{rightController}

					<Gamepad
						// Not using gamepad deadzone so we can handle it in our
						// handleGamepadAxisChange
						deadZone={0}
						onConnect={() => {
							console.log('connected');
							if (!this.props.weHaveInterval()) {
								this.props.createInterval()
							}
							this.clearRemoteControlValues()
						}}
						onAxisChange={(axisName: string, value: number) => {
							// Need to check for interval because onConnect is
							// only called at the start and does not get called again
							// if we are switching between bots
							if (!this.props.weHaveInterval()) {
								this.props.createInterval()
							}
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

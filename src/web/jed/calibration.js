import { byId } from './domQuery.js' 
import { api, JaiaAPI } from './api.js'
import { updateStatus } from './updateStatus.js'
import { BotDropdown } from './BotDropdown.js'
import { ActuatorInput } from './ActuatorInput.js'

// message SurfaceBounds {
//     optional int32 upper = 1  [default = 1100];
//     optional int32 lower = 2  [default = 1900];
//     optional int32 center = 3 [default = 1500];
// }
// message MotorBounds {
//     optional int32 forwardStart = 1 [default = 1600];
//     optional int32 reverseStart = 2 [default = 1400];
//     optional int32 max_reverse = 3 [default = 1320];
//     optional int32 throttle_zero_net_buoyancy = 4 [default = -35];
//     optional int32 throttle_dive = 5 [default = -35];
//     optional int32 throttle_ascent = 6 [default = 25];
// }

// message Bounds{
// optional SurfaceBounds strb = 1;
// optional SurfaceBounds port = 2;
// optional SurfaceBounds rudder = 3;
// optional MotorBounds motor = 4;               
// }

class CalibrationApp {

    constructor() {
        this.command = {
            bot_id: 1,
            control_surfaces: {
                motor: 1500,
                rudder: 1500,
                timeout: 5,
            }
        }

        this.bounds = {
            motor: {
                forwardStart: 1600,
                reverseStart: 1400,
                max_reverse: 1320
            },
            rudder: {
                upper: 1100,
                lower: 1900,
                center: 1500
            }
        }

        // Bot selector
        this.botDropdown = new BotDropdown('botSelect', (bot_id) => {
            this.command.bot_id = bot_id
        })

        // Motor actuator
        this.motorValue = byId('motor.value')
        this.motorInput = new ActuatorInput('motor.input', 1500, (value) => {
            this.motorValue.innerHTML = `${value} micros`
            this.command.control_surfaces.motor = value
        })

        // Rudder actuator
        this.rudderValue = byId('rudder.value')
        this.rudderInput = new ActuatorInput('rudder.input', 1500, (value) => {
            this.rudderValue.innerHTML = `${value} micros`
            this.command.control_surfaces.rudder = value
        })


        // Motor bounds
        this.maxReverseValue = byId('maxReverseValue')

        this.maxReverseSetButton = byId('bounds.motor.max_reverse.set')
        this.maxReverseSetButton.addEventListener('click', (e) => {
            this.bounds.motor.max_reverse = this.command.control_surfaces.motor
            this.updateBoundsInterface()
        })

        this.reverseStartValue = byId('reverseStartValue')
        this.reverseStartSetButton = byId('bounds.motor.reverseStart.set')
        this.reverseStartSetButton.addEventListener('click', (e) => {
            this.bounds.motor.reverseStart = this.command.control_surfaces.motor
            this.updateBoundsInterface()
        })

        this.forwardStartValue = byId('forwardStartValue')
        this.forwardStartSetButton = byId('bounds.motor.forwardStart.set')
        this.forwardStartSetButton.addEventListener('click', (e) => {
            this.bounds.motor.forwardStart = this.command.control_surfaces.motor
            this.updateBoundsInterface()
        })

        this.updateBoundsInterface()

        this.interval = setInterval(this.mainLoop.bind(this), 1000)
    }


    mainLoop() {
        console.log(`Engineering command:`)
        console.log(this.command)

        api.getStatus().then((status) => {
            updateStatus(status)
            this.botDropdown.updateWithBots(status.bots)
        })
    }


    updateBoundsInterface() {
        function getPercentX(microseconds) {
            return (microseconds - 1000) * 100 / 1000
        }

        this.maxReverseValue.innerHTML = `${this.bounds.motor.max_reverse} micros`
        this.maxReverseValue.style['left'] = `${getPercentX(this.bounds.motor.max_reverse)}%`

        this.reverseStartValue.innerHTML = `${this.bounds.motor.reverseStart} micros`
        this.reverseStartValue.style['left'] = `${getPercentX(this.bounds.motor.reverseStart)}%`

        this.forwardStartValue.innerHTML = `${this.bounds.motor.forwardStart} micros`
        this.forwardStartValue.style['left'] = `${getPercentX(this.bounds.motor.forwardStart)}%`
    }

}

const app = new CalibrationApp()

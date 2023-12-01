import { byId } from './domQuery.js' 
import { api, JaiaAPI } from './api.js'
import { updateStatus } from './updateStatus.js'
import { BotDropdown } from './BotDropdown.js'
import { ActuatorConfigSlider } from './ActuatorConfigSlider.js'

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
        this.defaultBounds = {
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
            this.bot_id = bot_id
        })

        this.motorConfigControl = new ActuatorConfigSlider('motor-config-control', this.defaultBounds.motor)
        this.rudderConfigControl = new ActuatorConfigSlider('rudder-config-control', this.defaultBounds.rudder)

        this.takeControlButton = byId('take-control')
        this.takeControlButton.addEventListener('click', this.takeControl.bind(this))

        this.submitButton = byId('submit-config')
        this.submitButton.addEventListener('click', this.submitConfig.bind(this))

        this.timer = setInterval(this.mainLoop.bind(this), 1000)
    }


    mainLoop() {
        api.getStatus().then((status) => {
            updateStatus(status)
            this.botDropdown.updateWithBots(status.bots)
        })
    }


    takeControl() {
        api.takeControl()
    }
        

    submitConfig(event) {
        const bot_id = this.botDropdown.getSelectedBotId()
        if (bot_id == null) {
            alert("Please select a bot first")
            return
        }

        const engineeringCommand = {
            bot_id: bot_id,
            bounds: {
                motor: this.motorConfigControl.getConfig(),
                rudder: this.rudderConfigControl.getConfig()
            }
        }

        api.sendEngineeringCommand(engineeringCommand, true)
    }

}

const app = new CalibrationApp()

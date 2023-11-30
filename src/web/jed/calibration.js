import { byId } from './domQuery.js' 
import { api, JaiaAPI } from './api.js'
import { updateStatus } from './updateStatus.js'
import { BotDropdown } from './BotDropdown.js'
import { ActuatorInput } from './ActuatorInput.js'


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

        // Bot selector
        this.botDropdown = new BotDropdown('botSelect', (bot_id) => {
            this.command.bot_id = bot_id
        })

        // Motor actuator
        this.motorValue = byId('motor.value')
        this.motorInput = new ActuatorInput('motor.input', 1500, (value) => {
            this.motorValue.innerHTML = `${value} microseconds`
            this.command.control_surfaces.motor = value
        })

        // Rudder actuator
        this.rudderValue = byId('rudder.value')
        this.rudderInput = new ActuatorInput('rudder.input', 1500, (value) => {
            this.rudderValue.innerHTML = `${value} microseconds`
            this.command.control_surfaces.rudder = value
        })

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

}

const app = new CalibrationApp()

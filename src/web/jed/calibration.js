import { byId } from './domQuery.js' 
import { api, JaiaAPI } from './api.js'
import { updateStatus } from './updateStatus.js'
import { botDropdown } from './BotDropdown.js'
import { ActuatorConfigSlider } from './ActuatorConfigSlider.js'

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

        this.motorConfigControl = new ActuatorConfigSlider('motor-config-control', this.defaultBounds.motor)
        this.rudderConfigControl = new ActuatorConfigSlider('rudder-config-control', this.defaultBounds.rudder)

        this.submitButton = byId('submit-config')
        this.submitButton.addEventListener('click', this.submitConfig.bind(this))

        this.queryButton = byId('query-engineering-status')
        this.queryButton.addEventListener('click', this.queryEngineeringStatus.bind(this))

        this.lastEngineeringStatusTime = 0
    }


    updateStatus(status) {
        console.log('1')
        // Update bounds, if the time is newer on this engineering status
        const selected_bot_id = botDropdown.getSelectedBotId()
        if (selected_bot_id == null) return

        console.log('2')
        const thisBot = status.bots[botDropdown.getSelectedBotId()]
        if (thisBot == null) return

        console.log('3')
        const engineering_status = thisBot.engineering
        if (engineering_status == null) return

        const engineeringStatusTime = Number(engineering_status.time)
        console.log(`${engineeringStatusTime} ${this.lastEngineeringStatusTime}`)
        if (engineeringStatusTime <= this.lastEngineeringStatusTime) return
        this.lastEngineeringStatusTime = engineeringStatusTime

        console.log('5')
        const bounds = engineering_status.bounds
        if (bounds == null) return

        console.log('updating bounds GUI')
        this.motorConfigControl.setConfig(bounds.motor)
        this.rudderConfigControl.setConfig(bounds.rudder)
    }


    submitConfig(event) {
        const bot_id = botDropdown.getSelectedBotId()
        if (bot_id == null) {
            alert("Please select a bot first")
            return
        }

        if (!api.inControl) {
            alert("We are not in control yet.  Please press 'Take Control' if you'd like to take control.")
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

    queryEngineeringStatus(event) {
        const bot_id = botDropdown.getSelectedBotId()
        if (bot_id == null) {
            alert("Please select a bot first")
            return
        }

        if (!api.inControl) {
            alert("We are not in control yet.  Please press 'Take Control' if you'd like to take control.")
            return
        }

        const engineeringCommand = {
            bot_id: bot_id,
            query_engineering_status: true
        }

        console.log(engineeringCommand)

        api.sendEngineeringCommand(engineeringCommand, true)
    }

}

export const calibrationApp = new CalibrationApp()

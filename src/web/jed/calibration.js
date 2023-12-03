import { byId } from './domQuery.js' 
import { api, JaiaAPI } from './api.js'
import { updateStatus } from './updateStatus.js'
import { BotDropdown } from './BotDropdown.js'
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

        this.queryButton = byId('query-engineering-status')
        this.queryButton.addEventListener('click', this.queryEngineeringStatus.bind(this))

        this.lastEngineeringStatusTime = 0

        this.timer = setInterval(this.mainLoop.bind(this), 1000)
    }


    mainLoop() {
        api.getStatus().then((status) => {
            updateStatus(status)
            this.botDropdown.updateWithBots(status.bots)
            this.updateStatus(status)
        })
    }


    updateStatus(status) {
        // Update bounds, if the time is newer on this engineering status
        const selected_bot_id = this.botDropdown.getSelectedBotId()
        if (selected_bot_id == null) return

        const thisBot = status.bots[this.botDropdown.getSelectedBotId()]
        if (thisBot == null) return

        const engineering_status = thisBot.engineering
        if (engineering_status == null) return

        const engineeringStatusTime = Number(engineering_status.time)
        if (engineeringStatusTime <= this.lastEngineeringStatusTime) return
        this.lastEngineeringStatusTime = engineeringStatusTime

        const bounds = engineering_status.bounds
        if (bounds == null) return

        console.log(`Updating GUI to:`)
        console.log(bounds)
        this.motorConfigControl.setConfig(bounds.motor)
        this.rudderConfigControl.setConfig(bounds.rudder)
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
        const bot_id = this.botDropdown.getSelectedBotId()
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

        api.sendEngineeringCommand(engineeringCommand, true)
    }

}

const app = new CalibrationApp()

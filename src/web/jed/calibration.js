import { byId } from './domQuery.js' 
import { api, JaiaAPI } from './api.js'
import { updateStatus } from './updateStatus.js'
import { botDropdown } from './BotDropdown.js'
import { ActuatorConfigSlider } from './ActuatorConfigSlider.js'
import { ActuatorConfigTextInputs } from './ActuatorConfigTextInputs.js'

class CalibrationApp {

    constructor() {
        this.defaultBounds = {
            motor: {
                forwardStart: 1600,
                reverseStart: 1400,
                maxReverse: 1320
            },
            rudder: {
                upper: 1100,
                lower: 1900,
                center: 1500
            }
        }

        this.motorConfigControl = new ActuatorConfigTextInputs('motor-bounds-config', this.defaultBounds.motor)
        this.rudderConfigControl = new ActuatorConfigTextInputs('rudder-bounds-config', this.defaultBounds.rudder)

        this.submitButton = byId('submit-config')
        this.submitButton.addEventListener('click', this.submitConfig.bind(this))

        this.queryButton = byId('query-engineering-status')
        this.queryButton.addEventListener('click', this.queryEngineeringStatus.bind(this))

        this.startIMUCalButton = byId('imu-cal-start-btn')
        this.startIMUCalButton.addEventListener('click', this.startIMUCalibration.bind(this))

        this.lastEngineeringStatusTime = 0
    }


    updateStatus(status) {
        // Update bounds, if the time is newer on this engineering status
        const selected_bot_id = botDropdown.getSelectedBotId()
        if (selected_bot_id == null) return

        const thisBot = status.bots[botDropdown.getSelectedBotId()]
        if (thisBot == null) return
        this.updateIMUCurrentCalibration(thisBot["calibration_status"])

        const engineering_status = thisBot.engineering
        if (engineering_status == null) return

        const engineeringStatusTime = Number(engineering_status.time)
        if (engineeringStatusTime <= this.lastEngineeringStatusTime) return
        this.lastEngineeringStatusTime = engineeringStatusTime

        const bounds = engineering_status.bounds
        if (bounds == null) return

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

        api.sendEngineeringCommand(engineeringCommand, true)
    }

    startIMUCalibration() {
        const botId = botDropdown.getSelectedBotId()
        if (botId === null || botId === "0") {
            alert("Please select a bot first.")
            return
        }

        if (!api.inControl) {
            alert("We are not in control yet. Please press 'Take Control' if you'd like to take control.")
            return
        }

        const engineeringCommand = {
            bot_id: botId,
            imu_cal: {
                run_cal: true
            }
        }
        api.sendEngineeringCommand(engineeringCommand, true)
        alert(`Sending calibration command to Bot ${botId}...`)
    }

    updateIMUCurrentCalibration(currentCalibration) {
        const calibrationValues = [1, 2, 3]
        let element = document.getElementById("imu-cal-current")
        if (calibrationValues.includes(currentCalibration)) {
            element.textContent = currentCalibration
        } else {
            element.textContent = "N/A"
        }
    }
}

export const calibrationApp = new CalibrationApp()

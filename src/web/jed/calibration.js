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
        if (thisBot == null)  return

        this.updateIMUCurrentCalibration(thisBot["calibration_status"]) 
        this.updateIMUCalibrationState(thisBot["calibration_state"])
        this.updateIMUCalibrationBtn(thisBot["calibration_state"])

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
        if (botId === "0") {
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
    }

    updateIMUCurrentCalibration(currentCalibration) {
        let element = document.getElementById("imu-cal-current")
        element.textContent = currentCalibration
    }

    updateIMUCalibrationState(calibrationState) {
        let element = document.getElementById('imu-cal-state')
        switch (calibrationState) {
            case "IN_PROGRESS":
                element.textContent = "IMU Calibration In Progress..."
                break
            case "COMPLETE":
                element.textContent = "IMU Calibration Complete"
                break
            default:
                element.textContent = ""
        }
    }

    updateIMUCalibrationBtn(calibrationState) {
      let element = document.getElementById("imu-cal-start-btn")
      if (calibrationState === "IN_PROGRESS") {
        element.disabled = true
        element.style.opacity = 0.9
      } else {
        element.disabled = false
        element.style.opacity = 1
      }
    }
}

export const calibrationApp = new CalibrationApp()

import { byId } from "./domQuery.js"
import { clamp } from "./utils.js"

const MICRO_MIN = 1000
const MICRO_MAX = 2000

class ActuatorConfigTextInputs {

    constructor(elementId, initialConfig) {
        // Get elements
        this.rootElement = byId(elementId)

        this.fields = []
        this._config = {}

        this.setConfig(initialConfig)

        for (const inputElement of this.rootElement.getElementsByClassName('actuator-input')) {
            this.fields.push({
                name: inputElement.id,
                inputElement: inputElement
            })

            // If field loses focus, clamp the value to the acceptable range
            inputElement.addEventListener('blur', (event) => {
                const value = Number(event.target.value)
                event.target.value = clamp(value, MICRO_MIN, MICRO_MAX)
            })
        }
    }

    setConfig(config) {
        for (const key of Object.keys(config)) {
            this._config[key] = config[key]
        }
        this.update()
    }

    update() {
        for (const field of this.fields) {
            if (field.inputElement !== undefined && field.inputElement.value !== undefined) {
                field.inputElement.value = this._config[field.name]
            }
        }
    }

    getConfig() {
        for (const field of this.fields) {
            this._config[field.name] = Math.round(Number(field.inputElement.value))
        }
        return this._config
    }
}

export { ActuatorConfigTextInputs }

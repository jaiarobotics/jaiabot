import { byId } from "./domQuery.js"
import { clamp } from "./utils.js"

const MICRO_MIN = 1000
const MICRO_MAX = 2000
const MICRO_RANGE = MICRO_MAX - MICRO_MIN

class ActuatorConfigTextInputs {

    constructor(elementId, initialConfig) {
        // Get elements
        this.rootElement = byId(elementId)

        this.fields = []
        for (const inputElement of this.rootElement.getElementsByClassName('actuator-input')) {
            this.fields.push({
                name: inputElement.id,
                inputElement: inputElement
            })

            // If field loses focus, clamp the value to the acceptable range
            inputElement.addEventListener('blur', (event) => {
                const value = Number(event.target.value)
                event.target.value = clamp(value, 1000, 2000)
            })
        }

        this.setConfig(initialConfig)
    }

    setConfig(config) {
        this._config = config
        this.update()
    }

    update() {
        console.log(this.fields)
        for (const field of this.fields) {
            field.inputElement.value = this._config[field.name]
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

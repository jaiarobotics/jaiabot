import { byId } from "./domQuery.js"

class ActuatorInput {

    constructor(elementId, initialValue, onChange) {
        this.inputElement = byId(elementId)

        this.inputElement.value = initialValue
        onChange(initialValue)

        this.inputElement.addEventListener('input', (e) => {
            onChange(Number(e.target.value))
        })
    }
}

export { ActuatorInput }

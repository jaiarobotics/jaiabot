import { byId } from "./domQuery.js"
import { clamp } from "./utils.js"

const MICRO_MIN = 1000
const MICRO_MAX = 2000
const MICRO_RANGE = MICRO_MAX - MICRO_MIN

class ActuatorConfigSlider {

    constructor(elementId, initialConfig) {
        // Get elements
        this.fullRange = byId(elementId)

        this.handles = []
        for (const handleElement of this.fullRange.getElementsByClassName('config-slider-handle')) {
            const textElement = handleElement.getElementsByClassName('config-slider-text')[0]

            this.handles.push({
                name: handleElement.id,
                handleElement: handleElement,
                textElement: textElement
            })

            handleElement.addEventListener('mousedown', this.mousedown.bind(this, handleElement.id))
        }

        // Set motor
        this._config = initialConfig

        // Add handlers
        this.pageX = 0
        this.fullRange.addEventListener("mousemove", this.mousemove.bind(this))

        // Update
        this.update()
    }

    update() {

        function getPercentX(microseconds) {
            return (microseconds - MICRO_MIN) * 100 / MICRO_RANGE
        }
            
        for (const handle of this.handles) {
            // Text
            const value = this._config[handle.name].toFixed(0)
            handle.textElement.innerHTML = `${handle.name}<br>${value}`

            // Position
            const xPercent = getPercentX(value)
            handle.handleElement.style.left = `${xPercent}%`
        }
    }

    mousedown(type, event) {
        this.type = type
        this.pageX = event.pageX
    }

    mousemove(event) {
        if (this.type == null) {
            return
        }

        var minValue = MICRO_MIN
        var maxValue = MICRO_MAX

        switch(this.type) {
            case 'forwardStart':
                minValue = this._config.reverseStart
                maxValue = MICRO_MAX
                break;
            case 'reverseStart':
                minValue = this._config.max_reverse
                maxValue = this._config.forwardStart
                break;
            case 'max_reverse':
                minValue = MICRO_MIN
                maxValue = this._config.reverseStart
                break;
            case 'lower':
                minValue = this._config.center
                maxValue = MICRO_MAX
                break;
            case 'center':
                minValue = this._config.upper
                maxValue = this._config.lower
                break;
            case 'upper':
                minValue = MICRO_MIN
                maxValue = this._config.center
                break;
        }

        if (event.buttons != 0) {
            const totalWidth = this.fullRange.offsetWidth
            if (this.pageX != 0) {
                const deltaX = event.pageX - this.pageX
                const deltaMicros = (deltaX / totalWidth) * MICRO_RANGE
                this._config[this.type] = clamp(this._config[this.type] + deltaMicros, minValue, maxValue)
                this.update()
            }
            this.pageX = event.pageX
        }
        else {
            this.type = null
        }

    }

    getConfig() {
        for (const name in this._config) {
            this._config[name] = Math.round(this._config[name])
        }
        return this._config
    }
}

export { ActuatorConfigSlider }

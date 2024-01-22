import { byId } from "./byId.js"

////////// Dead man's switch / throttle lock ////////

class DeadMansSwitch {

    constructor() {
        this.on = false
        this.button = byId('deadMansSwitch')

        for (const eventName in ['mousedown', 'touchstart']) {
            this.button.addEventListener(eventName, () => {
                this.setOn(true)
            })
        }

        for (const eventName in ['mouseup', 'mouseleave', 'touchend', 'touchcancel']) {
            this.button.addEventListener(eventName, () => {
                this.setOn(false)
            })
        }

        window.addEventListener('blur', () => {
            this.setOn(false)
        })
    }

    setOn(_on) {
        this.on = _on
        this.button.style.backgroundColor = _on ? "green" : "red"

        byId('throttleSlider').disabled = !_on
        byId('speedSlider').disabled = !_on

        if (!_on) {
        throttleSlider.value = 0
        speedSlider.value = 0
        }
    }
}

export const deadMansSwitch = new DeadMansSwitch()

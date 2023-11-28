import './api.js'
import { sendCommand } from './api.js'
import { byId } from './byId.js'

// Start with the default values
var bounds = {
  rudder : {upper : 1100, lower : 1900, center : 1500},
  motor : {
    forwardStart : 1600,
    reverseStart : 1400,
    max_reverse : 1320,
    throttle_zero_net_buoyancy : -35,
    throttle_dive : -35,
    throttle_ascent : 25,
  }
}

const boundsPane = byId('boundsPane')

const forwardStartInput = byId('forwardStartInput')
forwardStartInput.addEventListener('change', (e) => {
    bounds.motor.forwardStart = Number(e.target.value)
})

const reverseStartInput = byId('reverseStartInput')
reverseStartInput.addEventListener('change', (e) => {
    bounds.motor.reverseStart = Number(e.target.value)
})

const maxReverseInput = byId('maxReverseInput')
maxReverseInput.addEventListener('change', (e) => {
    bounds.motor.max_reverse = Number(e.target.value)
})

const boundsApplyButton = byId('boundsApplyButton')
boundsApplyButton.addEventListener('click', (e) => {
    const bot_id = byId('botSelect')?.value || "0"
    
    console.log({
        bot_id,
        bounds
    })

    sendCommand({
        bot_id,
        bounds
    })
})

// Update values
forwardStartInput.value = String(bounds.motor.forwardStart)
reverseStartInput.value = String(bounds.motor.reverseStart)
maxReverseInput.value = String(bounds.motor.max_reverse)


export function toggleBoundsPane() {
    if (boundsPane.classList.contains('hidden')) {
        boundsPane.classList.remove('hidden')

    }
    else {
        boundsPane.classList.add('hidden')
    }
}


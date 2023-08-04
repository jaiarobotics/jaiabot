import { Style } from "ol/style"
import { Icon } from "ol/style"

const rallyPointRedIcon = require('../icons/rally-point-red.svg')
const rallyPointGreenIcon = require('../icons/rally-point-green.svg')

export const rallyPointRedStyle = new Style({
    image: new Icon({
        src: rallyPointRedIcon,
        scale: [0.5, 0.5]
    })
})

export const rallyPointGreenStyle = new Style({
    image: new Icon({
        src: rallyPointGreenIcon,
        scale: [0.5, 0.5]
    })
})


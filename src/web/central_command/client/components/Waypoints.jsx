import {
	Icon as OlIcon, Style as OlStyle
} from 'ol/style';

import start from '../icons/start.svg'

console.warn('start = ', start)

const selectedColor = '#34d2eb'
const unselectedColor = '#5ec957'

function IconStyle(input_icon, color) {
    return new OlStyle({
        image: new OlIcon({
            src: input_icon.replace('#00ffff', color)
        })
    })
}

export const startSelected = IconStyle(start, selectedColor)
export const startUnSelected = IconStyle(start, unselectedColor)

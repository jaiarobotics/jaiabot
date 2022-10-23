import Stroke from 'ol/style/Stroke';
import {Circle as CircleStyle, Fill, Icon, Style, Text} from 'ol/style';

export const startMarker = new Style({
    image: new CircleStyle({
        radius: 6,
        stroke: new Stroke({
            color: 'white',
            width: 2
        }),
        fill: new Fill({
            color: 'green',
        }),
    })
})

export const endMarker = new Style({
    image: new Icon({
        src: '/stop.svg',
    })
})

export const botMarker = function(feature) {
    return new Style({
        image: new CircleStyle({
            radius: 8,
            stroke: new Stroke({
                color: 'white',
                width: 2
            }),
            fill: new Fill({
                color: 'blue',
            }),
        })
    })
}


// Markers for the mission goals
export function goal(goalIndex, goal) {
    return new Style({
        image: new CircleStyle({
            radius: 10,
            stroke: new Stroke({
                color: 'white',
                width: 2
            }),
            fill: new Fill({
                color: 'blue',
            }),
        }),
        text: new Text({
            text: new String(goalIndex),
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'white'
            })
        })
    })
}

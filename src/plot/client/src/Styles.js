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

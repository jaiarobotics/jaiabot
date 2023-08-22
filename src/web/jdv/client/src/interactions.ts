import { Map } from 'ol'
import { Draw } from 'ol/interaction'
import { DrawEvent } from 'ol/interaction/Draw'
import { Vector } from 'ol/source'
import { formatLength } from './shared/Utilities'
import * as Style from 'ol/style'

export function createMeasureInteraction(map: Map, measureResultCallback: (magnitude: string, unit: string) => void) {
    const measureInteraction = new Draw({
        source: new Vector(),
        type: 'LineString',
        style: new Style.Style({
            fill: new Style.Fill({
                color: 'rgba(255, 255, 255, 0.2)'
            }),
            stroke: new Style.Stroke({
                color: 'rgba(0, 0, 0, 0.5)',
                lineDash: [10, 10],
                width: 2
            }),
            image: new Style.Circle({
                radius: 5,
                stroke: new Style.Stroke({
                    color: 'rgba(0, 0, 0, 0.7)'
                }),
                fill: new Style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                })
            })
        })
    });

    measureInteraction.on('drawstart', (evt1: DrawEvent) => {
        evt1.feature.getGeometry().on('change', (evt2) => {
            const geom = evt2.target;
            const result = formatLength(geom, map)
            measureResultCallback(result.magnitude, result.unit)
        });
    })

    return measureInteraction
}

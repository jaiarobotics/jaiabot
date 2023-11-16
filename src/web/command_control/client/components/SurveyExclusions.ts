import { Feature as OlFeature } from "ol";
import { Style as OlStyle } from "ol/style";
import { Fill as OlFillStyle } from "ol/style";
import { Stroke as OlStrokeStyle } from "ol/style";
import { Circle as OlCircleStyle } from "ol/style";
import { Vector as OlVectorSource } from "ol/source";
import { Draw as OlDrawInteraction } from "ol/interaction";
import { EventsKey } from "ol/events";
import { Map as OlMap } from "ol";
import { DrawEvent } from "ol/interaction/Draw";
import * as turf from "@turf/turf"
import { MultiLineString } from "ol/geom";
import { LineString as OlLineString } from "ol/geom";
import { Vector as OlVectorLayer } from "ol/layer";
import { unByKey as OlUnobserveByKey } from "ol/Observable";


// Survey exclusion areas
const surveyExclusionsStyle = function(feature: OlFeature) {
    let lineStyle = new OlStyle({
        fill: new OlFillStyle({
            color: 'rgb(196,10,10)'
        }),
        stroke: new OlStrokeStyle({
            color: 'rgb(196,10,10)',
            lineDash: [10, 10],
            width: 5
        }),
        image: new OlCircleStyle({
            radius: 5,
            stroke: new OlStrokeStyle({
                color: 'rgb(196,10,10)'
            }),
            fill: new OlFillStyle({
                color: 'rgb(196,10,10)'
            })
        })
    });

    return [lineStyle];
};



export class SurveyExclusions {

    map: OlMap
    didChange: (surveyExclusions?: number[][]) => void

    source = new OlVectorSource({ wrapX: false });
    interaction = new OlDrawInteraction({
        source: this.source,
        stopClick: true,
        minPoints: 3,
        clickTolerance: 10,
        type: 'Polygon',
        style: surveyExclusionsStyle
    })

    listener: EventsKey

    /**
     * Layer for exclusion zones for survey missions
     *
     * @type {*}
     */
    layer = new OlVectorLayer({
        properties: { 
            name: 'exclusionsLayer',
            title: 'Mission Exclusion Areas'
        }
    });

    constructor(map: OlMap, didChange: (surveyExclusions: number[][]) => void) {
        this.map = map
        this.didChange = didChange

        this.interaction.on(
            'drawstart',
            (evt: DrawEvent) => {
                this.didChange(null)
    
                // Show the preview of the survey
                // this.surveyLines.listener = evt.feature.on('change', (evt2) => {
                //     // console.log('surveyExclusions changed...')
                // })
            }
        )

        this.interaction.on(
            'drawend',
            (evt: DrawEvent) => {
                // console.log('surveyExclusionsInteraction drawend');
        
                let featuresExclusions = [];
                let geometry = evt.feature.getGeometry() as MultiLineString
        
                let surveyExclusionsFeature = new OlFeature(
                    {
                        geometry: new OlLineString(turf.coordAll(turf.polygon(geometry.getCoordinates()))),
                        name: "Exclusions"
                    }
                )
                surveyExclusionsFeature.setStyle(surveyExclusionsStyle);
                featuresExclusions.push(surveyExclusionsFeature);
        
                const vectorSource = new OlVectorSource({
                    features: featuresExclusions,
                });
        
                this.layer.setSource(vectorSource);
                this.layer.setZIndex(5000);
        
                this.didChange(turf.coordAll(turf.polygon(geometry.getCoordinates())))

                OlUnobserveByKey(this.listener);
            }
        );
        
    }

}

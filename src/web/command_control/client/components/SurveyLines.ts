import { Vector as OlVectorSource } from "ol/source";
import { Draw as OlDrawInteraction } from "ol/interaction";
import { Feature as OlFeature } from "ol";
import { LineString, Point as OlPoint } from "ol/geom";
import { Style as OlStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Circle as OlCircleStyle, Icon as OlIcon, Text as OlText } from "ol/style";
import { EventsKey } from "ol/events";
import { DrawEvent } from "ol/interaction/Draw";
import { GeoJSON } from "ol/format";
import { unByKey as OlUnobserveByKey } from "ol/Observable";

import * as turf from "@turf/turf"

import $ from 'jquery';

// Jaia imports
import { deepcopy } from "./Utilities";
import CommandControl from "./CommandControl";

const missionOrientationIcon = require('../icons/compass.svg')


function round(value: any, precision: number): any {
    if (typeof value === "number")
        return Number(value.toFixed(precision));

    if (Array.isArray(value))
        return value.map(function(x) {return round(x, precision)});

    if (typeof value === "object" && value !== null)
        return Object.fromEntries(
            Object.entries(value)
                .map(([k, v]) => [k, round(v, precision)])
        );

    return value
}


// Survey planning using lines
function surveyLineStyle(feature: OlFeature<LineString>) {

    let stringCoords = feature.getGeometry().getCoordinates();
    let coords = stringCoords.slice(-2);
    if (
        coords[1][0] == coords[0][0] &&
        coords[1][1] == coords[0][1] &&
        stringCoords.length > 2
    ) {
        coords = stringCoords.slice(-3, -1);
    }

    const lineStyle = new OlStyle({
        fill: new OlFillStyle({
            color: 'rgb(196,10,10)'
        }),
        stroke: new OlStrokeStyle({
            color: 'rgb(196,10,10)',
            lineDash: [10, 10],
            width: 3
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

    let iconStyle = new OlStyle({
        geometry: new OlPoint(coords[0]),
        image: new OlIcon({
            src: missionOrientationIcon,
            scale: [0.5, 0.5],
            rotation: Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1])
        }),
        text: new OlText({
            font: '15px Calibri,sans-serif',
            fill: new OlFillStyle({ color: '#000000' }),
            stroke: new OlStrokeStyle({
                color: '#ffffff', width: .1
            }),
            placement: 'point',
            textAlign: 'start',
            justify: 'left',
            textBaseline: 'bottom',
            offsetY: -100,
            offsetX: 100
        })
    });

    return [lineStyle, iconStyle]
}

        
export class SurveyLines {
    commandControl: CommandControl
    vectorSource: OlVectorSource
    listener: EventsKey
    drawInteraction: OlDrawInteraction

    constructor(commandControl: CommandControl) {
        this.commandControl = commandControl

        this.vectorSource = new OlVectorSource({ wrapX: false });

        this.drawInteraction = new OlDrawInteraction({
            source: this.vectorSource,
            stopClick: true,
            minPoints: 2,
            maxPoints: 2,
            clickTolerance: 10,
            type: 'LineString',
            style: surveyLineStyle
        })

        this.drawInteraction.on(
            'drawstart',
            (evt: DrawEvent) => {
                commandControl.setState({
                    missionPlanningFeature: null
                })
                commandControl.updateMissionLayer();
        
                // Show the preview of the survey
                this.listener = evt.feature.on('change', (evt2) => {
                    // console.log('** START ********* ON CHANGE *************************')
                    const geom1 = evt2.target;
                    // console.log('geom1');
                    // console.log(geom1);
        
                    const format = new GeoJSON();
        
                    let { missionParams, rallyPointGreenLocation, rallyPointRedLocation, surveyExclusions } = commandControl.state;
        
                    let stringCoords = geom1.getGeometry().getCoordinates()
        
                    if (stringCoords[0].length >= 2) {
                        let coords = stringCoords.slice(-2);
                        let rotAngRadians = Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]);
        
                        let rotationAngle = Number((Math.trunc(turf.radiansToDegrees(rotAngRadians)*100)/100).toFixed(2));
                        if (rotationAngle < 0) {
                            rotationAngle = rotationAngle + 360;
                        }
                        missionParams.orientation = rotationAngle;
                        // document.getElementById('missionOrientation').setAttribute('value', rotationAngle.toString())
        
                        let bot_list = Object.keys(commandControl.state.podStatus.bots);
        
                        // console.log('TESTING')
                        // console.log(this);
                        // console.log(this.podStatus.bots);
                        // console.log(turf);
                        // console.log(format);
        
                        let maxLineLength = (Number(missionParams.spacing) * Number(missionParams.num_goals)) / 1000;
                        let centerLineString = turf.lineString([stringCoords[0], stringCoords[1]]);
        
                        // Check if user selects length > allowed (bots * spacing), if so make centerLine max length
                        let currentCenterLineLength = turf.length(turf.toWgs84(centerLineString));
                        // console.log('currentCenterLineLength');
                        // console.log(currentCenterLineLength);
                        // console.log('maxLineLength');
                        // console.log(maxLineLength);
                        if (currentCenterLineLength >= maxLineLength) {
                            let rhumbPoint = turf.rhumbDestination(turf.toWgs84(turf.point(stringCoords[0])), maxLineLength-(Number(missionParams.spacing)/1000), rotationAngle)
                            // console.log('rhumbPoint');
                            // console.log(rhumbPoint);
                            centerLineString = turf.lineString([stringCoords[0], turf.toMercator(rhumbPoint).geometry.coordinates])
                            // console.log('centerLineString');
                            // console.log(centerLineString);
                        }
        
                        let centerLineStringWgs84 = turf.toWgs84(centerLineString);
        
                        // TODO: Maybe use turf.shortestPath here to find a way around the exclusion
                        // let centerLineStringWgs84Diverted = null;
                        // let centerLineStringWgs84Points = turf.coordAll(centerLineStringWgs84);
                        // console.log('centerLineStringWgs84Points')
                        // console.log(centerLineStringWgs84Points)
                        // if (this.state.surveyExclusions === 6) {
                        // 	let se = this.state.surveyExclusions
                        // 	let optionsExc = {
                        // 		'obstacles': turf.polygon([turf.coordAll(turf.toWgs84(turf.multiPoint(se)))]),
                        // 		// 'minDistance': Number(missionParams.spacing)/1000,
                        // 		'resolution': maxLineLength
                        // 	}
                        // 	console.log('optionsExc')
                        // 	console.log(optionsExc)
                        // 	centerLineStringWgs84Diverted = turf.shortestPath(centerLineStringWgs84Points[0], centerLineStringWgs84Points[1], optionsExc)
                        // } else {
                        // 	centerLineStringWgs84Diverted = centerLineStringWgs84;
                        // }
        
                        let centerLineStringWgs84Chunked = turf.lineChunk(centerLineStringWgs84, Number(missionParams.spacing)/1000)
                        let centerLineFc = turf.combine(centerLineStringWgs84Chunked);
        
        
                        let centerLine = turf.getGeom(centerLineFc as any).features[0];
                        this.commandControl.setState({center_line_string: centerLineString})						
                        let currentLineLength = turf.length(centerLine)
        
                        if (currentLineLength <= maxLineLength-(Number(missionParams.spacing)/1000)) {
                            let offsetLines: any[] = [];
                            let lineOffsetStart = -1 * (Number(missionParams.spacing) * ((bot_list.length/2)*0.75))
                            let nextLineOffset = 0;
                            let currentLineOffset = 0;
        
                            bot_list.forEach(bot => {
                                let ol = deepcopy(centerLine);
                                currentLineOffset = lineOffsetStart + nextLineOffset
        
                                ol.properties['botId'] = bot;
                                ol = turf.transformTranslate(ol, currentLineOffset/1000, rotationAngle+90)
        
                                offsetLines.push(ol);
                                nextLineOffset = nextLineOffset + Number(missionParams.spacing)
                            })
        
                            let alongLines: any = {};
                            let alongPoints: {[key: string]: number[][]} = {};
                            offsetLines.forEach(offsetLine => {
                                turf.geomEach(offsetLine, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
                                    let botId = featureProperties.botId as number;
                                    alongLines[botId] = turf.toMercator(currentGeometry).coordinates
                                });
                                if (commandControl.state.surveyExclusions) {
                                    let alongPointsBeforeExclusion = turf.coordAll(turf.cleanCoords(turf.multiPoint(round(turf.coordAll(turf.explode(offsetLine)), 7))))
                                    let alongPointsAfterExclusion: number[][] = []
                                    alongPointsBeforeExclusion.forEach(point => {
                                        // console.log('this.state.surveyExclusions');
                                        let se = turf.coordAll(turf.toWgs84(turf.multiPoint(surveyExclusions)));
                                        // console.log(se);
                                        // console.log(point);
                                        let options = {'ignoreBoundary': true}
                                        if (turf.booleanPointInPolygon(point, turf.polygon([se]), options) === false) {
                                            alongPointsAfterExclusion.push(point)
                                        }
                                    })
                                    // let alongPointsAfterExclusion = turf.pointsWithinPolygon(turf.mutliPoint(alongPointsBeforeExclusion), turf.polygon(this.state.surveyExclusions))
                                    alongPoints[offsetLine.properties.botId] = turf.coordAll(turf.toMercator(turf.multiPoint(alongPointsAfterExclusion)))
                                } else {
                                    alongPoints[offsetLine.properties.botId] = turf.coordAll(turf.toMercator(turf.cleanCoords(turf.multiPoint(round(turf.coordAll(turf.explode(offsetLine)), 7)))))
                                }
                            })
        
                            // Metadata setup
                            // TODO: Add hub position so we can get a distance to furthest point away from it, no LL atm
                            // console.log('hubs');
                            // console.log(Object.values(this.podStatus?.hubs ?? {}));
                            let fcInput: turf.helpers.Feature<turf.helpers.Point>[] = []
                            Object.keys(alongPoints).forEach(key => {
                                let points = alongPoints[key]
                                points.forEach(point => {
                                    fcInput.push(turf.toWgs84(turf.point(point)))
                                })
                            })
        
                            // Make sure this would be a valid polygon before changing the stats
                            if (fcInput.length >= 3 && Object.keys(alongPoints).length > 1) {
                                let fcOutput = turf.featureCollection(fcInput)
                                let fcOutputPoly = turf.concave(fcOutput)
                                missionParams.sp_perimeter = round(turf.length(fcOutputPoly), 2)
                                missionParams.sp_area = round(turf.area(fcOutputPoly)/1000, 2)
                            }
        
                            missionParams.sp_rally_start_dist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[0], turf.point([rallyPointGreenLocation.lon, rallyPointGreenLocation.lat])), 2)
                            missionParams.sp_rally_finish_dist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[1], turf.point([rallyPointRedLocation.lon, rallyPointRedLocation.lat])), 2)
        
                            commandControl.setState({
                                missionPlanningLines: alongLines,
                                missionPlanningGrid: alongPoints,
                                missionParams: missionParams
                            }, () => commandControl.updateMissionLayer())
                        }
        
                        // Metadata/Stats
                        $('#missionStatArea').text(missionParams.sp_area);
                        $('#missionStatPerimeter').text(missionParams.sp_perimeter);
                        $('#missionStatOrientation').text(missionParams.orientation);
                        $('#missionStatRallyStartDistance').text(missionParams.sp_rally_start_dist);
                        $('#missionStatRallyFinishDistance').text(missionParams.sp_rally_finish_dist);
        
                        // console.log('** END ********* ON CHANGE *************************')
                    }
                })
            })

        this.drawInteraction.on(
            'drawend',
            (evt: DrawEvent) => {
                // console.log('surveyLinesInteraction drawend');
                // this.surveyLinesInteraction.finishDrawing();
                // this.updateMissionLayer();
                // console.log(evt);
                // console.log(map);
        
                commandControl.setState({
                    missionPlanningFeature: evt.feature
                })
        
                // console.log(this.surveyLinesInteraction);
                // console.log(this.surveyLinesInteraction.finishCoordinate_);
                // console.log(this.surveyLinesInteraction.sketchCoords_);
                commandControl.updateMissionLayer();
                OlUnobserveByKey(this.listener);
        
                // map.changed();
                // map.renderSync();
                // map.updateSize();
            }
        );
            
    }


}

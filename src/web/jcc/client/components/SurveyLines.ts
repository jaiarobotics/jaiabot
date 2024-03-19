// OpenLayers imports
import { Style as OlStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Circle as OlCircleStyle, Icon as OlIcon, Text as OlText } from "ol/style";
import { LineString, Point as OlPoint } from "ol/geom";
import { unByKey as OlUnobserveByKey } from "ol/Observable";
import { Draw as OlDrawInteraction } from "ol/interaction";
import { Vector as OlVectorSource } from "ol/source";
import { Feature as OlFeature } from "ol";
import { EventsKey } from "ol/events";
import { DrawEvent } from "ol/interaction/Draw";
import { warning } from "../libs/notifications";

// Jaia imports
import CommandControl from "./CommandControl";
import { deepcopy } from "./shared/Utilities";

import * as turf from "@turf/turf"

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
                if (!commandControl.state.startRally || !commandControl.state.endRally) {
                    warning('Please select a start and end rally point for this run')
                }
                commandControl.setState({ missionPlanningFeature: null })
                commandControl.updateMissionLayer();
        
                // Show the preview of the survey
                this.listener = evt.feature.on('change', (evt2) => {
                    const geom1 = evt2.target;
                    let { missionParams, surveyExclusionCoords, startRally, endRally } = commandControl.state;
                    let stringCoords = geom1.getGeometry().getCoordinates()

                    this.validateSurveySpacingInputs()
        
                    if (stringCoords[0].length >= 2 && startRally && endRally) {
                        let coords = stringCoords.slice(-2);
                        let rotAngRadians = Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]);
                        let rotationAngle = Number((Math.trunc(turf.radiansToDegrees(rotAngRadians)*100)/100).toFixed(2));
                        
                        if (rotationAngle < 0) {
                            rotationAngle = rotationAngle + 360;
                        }

                        missionParams.orientation = rotationAngle;
                        let numRuns = Number(missionParams.numRuns);   
                        let maxLineLength = (Number(missionParams.pointSpacing) * Number(missionParams.numGoals)) / 1000;
                        let centerLineString = turf.lineString([stringCoords[0], stringCoords[1]]);
        
                        // Check if user selects length > allowed (numWpts * pointSpacing), if so make centerLine max length
                        let currentCenterLineLength = turf.length(turf.toWgs84(centerLineString));
                        if (currentCenterLineLength >= maxLineLength) {
                            let rhumbPoint = turf.rhumbDestination(turf.toWgs84(turf.point(stringCoords[0])), maxLineLength-(Number(missionParams.pointSpacing)/1000), rotationAngle)
                            centerLineString = turf.lineString([stringCoords[0], turf.toMercator(rhumbPoint).geometry.coordinates])
                        }
        
                        let centerLineStringWgs84 = turf.toWgs84(centerLineString);        
                        let centerLineStringWgs84Chunked = turf.lineChunk(centerLineStringWgs84, Number(missionParams.pointSpacing)/1000)
                        let centerLineFc = turf.combine(centerLineStringWgs84Chunked);
        
        
                        let centerLine = turf.getGeom(centerLineFc as any).features[0];
                        this.commandControl.setState({centerLineString: centerLineString})						
                        let currentLineLength = turf.length(centerLine)
        
                        if (currentLineLength <= maxLineLength-(Number(missionParams.pointSpacing)/1000)) {
                            let offsetLines: any[] = [];
                            let lineOffsetStart = -1 * (Number(missionParams.lineSpacing) * (numRuns/2*0.75))
                            let nextLineOffset = 0;
                            let currentLineOffset = 0;
        
                            for(let i = 0; i < numRuns; i++){
                                let ol = deepcopy(centerLine);
                                currentLineOffset = lineOffsetStart + nextLineOffset
        
                                ol.properties['botId'] = i; //JAIAB-872: This was originally set to a real botId
                                //setting them all to to -1 or changing the property name to anything other
                                //than 'botId' resulted in only one run generated.  Not sure how this code 
                                //interacts with other elements
                                ol = turf.transformTranslate(ol, currentLineOffset/1000, rotationAngle+90)
        
                                offsetLines.push(ol);
                                nextLineOffset = nextLineOffset + Number(missionParams.lineSpacing)
                            }
        
                            let alongLines: any = {};
                            let alongPoints: {[key: string]: number[][]} = {};
                            offsetLines.forEach(offsetLine => {
                                turf.geomEach(offsetLine, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
                                    let botId = featureProperties.botId as number;
                                    alongLines[botId] = turf.toMercator(currentGeometry).coordinates
                                });
                                if (surveyExclusionCoords) {
                                    let alongPointsBeforeExclusion = turf.coordAll(turf.cleanCoords(turf.multiPoint(round(turf.coordAll(turf.explode(offsetLine)), 7))))
                                    let alongPointsAfterExclusion: number[][] = []
                                    alongPointsBeforeExclusion.forEach(point => {
                                        let se = turf.coordAll(turf.toWgs84(turf.multiPoint(surveyExclusionCoords)));
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
                                missionParams.spPerimeter = round(turf.length(fcOutputPoly), 2)
                                missionParams.spArea = round(turf.area(fcOutputPoly)/1000, 2)
                            }
        
                            missionParams.spRallyStartDist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[0], turf.point([startRally.get('location').lon, startRally.get('location').lat])), 2)
                            missionParams.spRallyFinishDist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[1], turf.point([endRally.get('location').lon, endRally.get('location').lat])), 2)
        
                            commandControl.setState({
                                missionPlanningLines: alongLines,
                                missionPlanningGrid: alongPoints,
                                missionParams: missionParams
                            }, () => commandControl.updateMissionLayer())
                        }
        
                        // Metadata/Stats
                        document.getElementById('missionStatArea').innerHTML = missionParams.spArea.toFixed(2) + " km&sup2;";
                        document.getElementById('missionStatPerimeter').innerText = missionParams.spPerimeter.toFixed(2) + " km";
                        document.getElementById('missionStatOrientation').innerText = missionParams.orientation.toFixed(2) + " deg";
                        document.getElementById('missionStatRallyStartDistance').innerText = missionParams.spRallyStartDist.toFixed(2) + " km";;
                        document.getElementById('missionStatRallyFinishDistance').innerText = missionParams.spRallyFinishDist.toFixed(2) + " km";;
                    }
                })
            })

        this.drawInteraction.on(
            'drawend',
            (evt: DrawEvent) => {
                if (!commandControl.state.startRally || !commandControl.state.endRally) {
                    return
                }
        
                commandControl.setState({
                    missionPlanningFeature: evt.feature
                })
        
                commandControl.updateMissionLayer();
                OlUnobserveByKey(this.listener);
            }
        )
    }

    /**
     * Converts zeros passed as spacing values to ones to prevent the preview from breaking
     * 
     * @returns {void}
     * 
     * @notes
     * We know this code needs a refactor as it violates React best practices. This is a
     * temporary solution to meet an urgent business requirement. 
     */
    validateSurveySpacingInputs() {
        if (this.commandControl.state.missionParams.pointSpacing === 0) {
            this.commandControl.state.missionParams.pointSpacing = 1
        }

        if (this.commandControl.state.missionParams.lineSpacing === 0) {
            this.commandControl.state.missionParams.lineSpacing = 1
        }
    }
}

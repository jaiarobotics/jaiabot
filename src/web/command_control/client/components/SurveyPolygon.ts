import { Draw as OlDrawInteraction } from "ol/interaction";
import * as style from "ol/style";
import { EventsKey } from "ol/events";
import { DrawEvent } from "ol/interaction/Draw";
import { GeoJSON } from "ol/format";
import BaseEvent from "ol/events/Event"
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { unByKey } from "ol/Observable";

import * as turf from "@turf/turf"


// Jaia imports
import CommandControl, { Mode } from "./CommandControl"

const getElementById = document.getElementById


export class SurveyPolygon {

    commandControl: CommandControl
    drawInteraction: OlDrawInteraction
    listener: EventsKey

    constructor(commandControl: CommandControl) {

        this.commandControl = commandControl

        this.drawInteraction = new OlDrawInteraction({
            // features: map.missionPlanningLayer.features,
            //source: surveyPolygonSource,
            stopClick: true,
            minPoints: 3,
            clickTolerance: 10,
            // finishCondition: event => {
            // 	return this.surveyPolygonInteraction.finishCoordinate_ === this.surveyPolygonInteraction.sketchCoords_[0][0];
            // },
            type: 'Polygon',
            style: new style.Style({
                fill: new style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new style.Stroke({
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineDash: [10, 10],
                    width: 2
                }),
                image: new style.Circle({
                    radius: 5,
                    stroke: new style.Stroke({
                        color: 'rgba(0, 0, 0, 0.7)'
                    }),
                    fill: new style.Fill({
                        color: 'rgba(255, 255, 255, 0.2)'
                    })
                })
            })
        });

        this.drawInteraction.on(
            'drawstart',
            (evt: DrawEvent) => {
                const { missionParams } = commandControl.state
                const podStatus = commandControl.state.podStatus

                commandControl.setState({
                    surveyPolygonChanged: true,
                    mode: Mode.MISSION_PLANNING,
                    missionPlanningFeature: null
                });
                commandControl.updateMissionLayer();

                this.listener = evt.feature.on('change', (evt2: BaseEvent) => {
                    const geom1 = evt2.target;

                    const format = new GeoJSON();
                    const turfPolygon = format.writeFeatureObject(geom1) as any

                    if (turfPolygon.geometry.coordinates[0].length > 500) {

                        let cellSide = missionParams.spacing;

                        let options = {units: 'meters' as turf.helpers.Units, mask: turf.toWgs84(turfPolygon)};

                        let turfPolygonBbox = turf.bbox(turf.toWgs84(turfPolygon));

                        let missionPlanningGridTurf = turf.pointGrid(turfPolygonBbox, cellSide, options);

                        if (missionPlanningGridTurf.features.length > 0) {

                            let missionPlanningGridTurfCentroid = turf.centroid(missionPlanningGridTurf);
                            let optionsRotate = {pivot: missionPlanningGridTurfCentroid};
                            let missionPlanningGridTurfRotated = turf.transformRotate(missionPlanningGridTurf, missionParams.orientation, optionsRotate);

                            if (missionPlanningGridTurfRotated.features.length > 0) {
                                // const missionPlanningGridOl = format.readFeatures(missionPlanningGridTurf, {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
                                let turfCombined = turf.combine(missionPlanningGridTurfRotated);

                                const missionPlanningGridOl = format.readFeature(turfCombined.features[0].geometry, {
                                    dataProjection: 'EPSG:4326',
                                    featureProjection: 'EPSG:3857'
                                });

                                let optionsMissionLines = {units: 'meters' as turf.helpers.Units};
                                let botDictLength = Object.keys(podStatus.bots).length
                                let botList = Array.from(Array(botDictLength).keys());
                                let missionRhumbDestPoint = turf.rhumbDestination(missionPlanningGridTurfCentroid, missionParams.spacing * botDictLength, missionParams.orientation, optionsMissionLines);

                                let centerLine = turf.lineString([missionPlanningGridTurfCentroid.geometry.coordinates, missionRhumbDestPoint.geometry.coordinates]);

                                let lineSegments: any[] = [];
                                let firstDistance = 0;
                                let nextDistance = missionParams.spacing;
                                botList.forEach(bot => {
                                    let ls = turf.lineSliceAlong(centerLine, firstDistance, nextDistance, {units: 'meters'});
                                    lineSegments.push(ls);
                                    firstDistance = nextDistance;
                                    nextDistance = nextDistance + missionParams.spacing;
                                })

                                // let lineSegmentsFc = turf.featureCollection(lineSegments);
                                let lineSegmentsMl = turf.multiLineString(lineSegments)
                                // console.log('lineSegmentsMl');
                                // console.log(lineSegmentsMl);



                                let offsetLines: any[] = [];


                                // let x = turf.getGeom(lineSegmentsMl);
                                // let y = [];
                                // x.coordinates.forEach(coord => {
                                // 	y.push()
                                // })

                                let ol = turf.lineOffset(centerLine, 0, {units: 'meters'});
                                offsetLines.push(ol);
                                botList.forEach(bot => {
                                    ol = turf.lineOffset(ol, missionParams.spacing, {units: 'meters'});
                                    offsetLines.push(ol);
                                })




                                // let offsetLine = turf.lineOffset(centerLine, this.state.missionParams.spacing, {units: 'meters'});
                                // console.log('offsetLines');
                                // console.log(offsetLines);

                                let missionPlanningLinesTurf = turf.multiLineString(offsetLines);
                                // console.log('missionPlanningLinesTurf');
                                // console.log(missionPlanningLinesTurf);

                                // console.log(OlFeature);
                                // console.log(OlMultiLineString);
                                let a = turf.getGeom(missionPlanningLinesTurf)
                                let b: any[] = []
                                a.coordinates.forEach(coord => {
                                    b.push((format.readFeature(coord, {
                                        dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'
                                    }).getGeometry() as any).getCoordinates());
                                })
                                // console.log(b);
                                // const missionPlanningLinesOl = format.readFeatures(turf.getGeom(missionPlanningLinesTurf), {
                                // 	dataProjection: 'EPSG:4326',
                                // 	featureProjection: 'EPSG:3857'
                                // })

                                let c = turf.getGeom(missionPlanningLinesTurf)
                                let d: any[] = []
                                c.coordinates.forEach(coord => {
                                    d.push((format.readFeature(turf.explode(coord as any).features[0], {
                                        dataProjection: 'EPSG:4326',
                                        featureProjection: 'EPSG:3857'
                                    }).getGeometry() as any).getCoordinates())
                                })

                                commandControl.setState({
                                    missionPlanningLines: b,
                                    missionPlanningGrid: d
                                })
                            }
                        }

                        // tooltipCoord = geom.getLastCoordinate();
                        // getElementById('surveyPolygonResult').innerText = CommandControl.formatLength(geom);
                    }

                    let spArea = Math.trunc(turf.area(turf.toWgs84(turfPolygon))/1000000*100)/100;
                    let spPerimeter = Math.trunc(turf.length(turf.toWgs84(turfPolygon))*100)/100
                    if (spArea !== undefined && spPerimeter !== undefined) {
                        missionParams.spArea = spArea
                        missionParams.spPerimeter = spPerimeter;
                    }

                    getElementById('missionStatArea').innerText = missionParams.spArea.toFixed(2);
                    getElementById('missionStatPerimeter').innerText = missionParams.spPerimeter.toFixed(2);
                    getElementById('missionStatOrientation').innerText = missionParams.orientation.toFixed(2);
                    getElementById('missionStatRallyStartDistance').innerText = missionParams.spRallyStartDist.toFixed(2);
                    getElementById('missionStatRallyFinishDistance').innerText = missionParams.spRallyFinishDist.toFixed(2);

                    commandControl.updateMissionLayer();

                    // if (turfPolygon.geometry.coordinates[0].length > 5) {
                    // 	let geoGeom = geom1.getGeometry();
                    // 	geoGeom.transform("EPSG:3857", "EPSG:4326")
                    // 	let surveyPolygonGeoCoords = geoGeom.getCoordinates()
                    //
                    // 	this.setState({
                    // 		// missionPlanningGrid: missionPlanningGridOl.getGeometry(),
                    // 		// missionPlanningLines: missionPlanningLinesOl.getGeometry(),
                    // 		surveyPolygonGeoCoords: surveyPolygonGeoCoords,
                    // 		surveyPolygonCoords: geoGeom,
                    // 		surveyPolygonChanged: true
                    // 	});
                    // 	this.updateMissionLayer();
                    // }


                });
                commandControl.updateMissionLayer();
            }
        );

        this.drawInteraction.on(
            'drawend',
            (evt: DrawEvent) => {
                const { missionParams } = commandControl.state

                commandControl.setState({
                    surveyPolygonChanged: true,
                    mode: Mode.MISSION_PLANNING,
                    missionPlanningFeature: evt.feature
                });
                commandControl.updateMissionLayer();

                const geom1 = evt.feature;
                // console.log('geom1');
                // console.log(geom1);

                const format = new GeoJSON();
                const turfPolygon = format.writeFeatureObject(geom1);
                let spArea = Math.trunc(turf.area(turf.toWgs84(turfPolygon))/1000000*100)/100;
                let spPerimeter = Math.trunc(turf.length(turf.toWgs84(turfPolygon))*100)/100
                // console.log('spArea');
                // console.log(spArea);
                // if (spArea !== undefined && spPerimeter !== undefined) {
                // 	this.setState({
                // 		missionParams['sp_area']: spArea,
                // 		missionParams['sp_perimeter']: spPerimeter
                // 	})
                // 	this.state.missionParams.sp_area = spArea
                // 	this.state.missionParams.sp_perimeter = spPerimeter;
                // }

                let geoGeom = (evt.feature as Feature<LineString>).getGeometry();
                geoGeom.transform("EPSG:3857", "EPSG:4326")
                let surveyPolygonGeoCoords = geoGeom.getCoordinates()

                commandControl.setState({
                    surveyPolygonFeature: evt.feature,
                    surveyPolygonGeoCoords: surveyPolygonGeoCoords,
                    surveyPolygonCoords: geoGeom,
                    surveyPolygonChanged: true,
                    missionPlanningFeature: geom1
                })

                // console.log(Math.trunc(turf.convertArea(turf.area(turf.toWgs84(turfPolygon))*100, 'meters', 'kilometers'))/100);

                getElementById('missionStatArea').innerText = missionParams.spArea.toFixed(2);
                getElementById('missionStatPerimeter').innerText = missionParams.spPerimeter.toFixed(2);
                getElementById('missionStatOrientation').innerText = missionParams.orientation.toFixed(2);
                getElementById('missionStatRallyStartDistance').innerText = missionParams.spRallyStartDist.toFixed(2);
                getElementById('missionStatRallyFinishDistance').innerText = missionParams.spRallyFinishDist.toFixed(2);

                commandControl.updateMissionLayer();
                unByKey(this.listener);

                // map.changed();
                // map.renderSync();
                // map.updateSize();
            }
        );

    }
}

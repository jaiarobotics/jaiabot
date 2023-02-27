/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/self-closing-comp */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/sort-comp */
/* eslint-disable react/no-danger */
/* eslint-disable max-len */
/* eslint-disable react/no-unused-state */
/* eslint-disable react/no-multi-comp */

import React, { MouseEvent, ReactElement } from 'react'
import { Load, Save, GlobalSettings } from './Settings'
import { Missions, SELECTED_BOT_ID } from './Missions'
import { GoalSettingsPanel } from './GoalSettings'
import { MissionSettingsPanel } from './MissionSettings'
import { MissionLibraryLocalStorage } from './MissionLibrary'
import EngineeringPanel from './EngineeringPanel'
import { taskData } from './TaskPackets'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiDelete, mdiPlay, mdiFolderOpen, mdiContentSave, 
	mdiLanDisconnect, mdiCheckboxMarkedCirclePlusOutline, 
	mdiFlagVariantPlus, mdiSkipNext, mdiArrowULeftTop, mdiDownload,
    mdiStop, mdiPause} from '@mdi/js'

import Button from '@mui/material/Button';

// TurfJS
import * as turf from '@turf/turf';

// ThreeJS
/*import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
*/
// Openlayers
import OlMap from 'ol/Map';
import {
	DragAndDrop as DragAndDropInteraction,
	Select as SelectInteraction,
	Translate as TranslateInteraction,
	Pointer as PointerInteraction,
	defaults as defaultInteractions,
	Interaction,
	DragAndDrop,
} from 'ol/interaction';
import OlView from 'ol/View';
import OlIcon from 'ol/style/Icon'
import OlText from 'ol/style/Text'
import OlLayerGroup from 'ol/layer/Group';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceXYZ from 'ol/source/XYZ';
import { doubleClick } from 'ol/events/condition';
import OlGraticule from 'ol/layer/Graticule';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import OlPoint from 'ol/geom/Point';
import OlMultiPoint from 'ol/geom/MultiPoint';
import OlMultiLineString from 'ol/geom/MultiLineString';
import OlFeature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import {GPX, IGC, KML, TopoJSON} from 'ol/format';
import OlTileLayer from 'ol/layer/Tile';
import { createEmpty as OlCreateEmptyExtent, extend as OlExtendExtent } from 'ol/extent';
import OlScaleLine from 'ol/control/ScaleLine';
import OlMousePosition from 'ol/control/MousePosition';
import OlZoom from 'ol/control/Zoom';
import OlRotate from 'ol/control/Rotate';
import { Coordinate, createStringXY as OlCreateStringXY } from 'ol/coordinate';
import { unByKey as OlUnobserveByKey } from 'ol/Observable';
import { getLength as OlGetLength } from 'ol/sphere';
import { Geometry, LineString, MultiLineString, LineString as OlLineString, Polygon } from 'ol/geom';
import OlDrawInteraction, { DrawEvent } from 'ol/interaction/Draw';
import {
	Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlLayerSwitcher from 'ol-layerswitcher';
import OlAttribution from 'ol/control/Attribution';
import { TransformFunction, getTransform, toUserResolution } from 'ol/proj';
import { deepcopy, areEqual, randomBase57 } from './Utilities';

import * as MissionFeatures from './gui/MissionFeatures'

import $ from 'jquery';
// import 'jquery-ui/themes/base/core.css';
// import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/widgets/resizable';
// import 'jquery-ui/themes/base/resizable.css';
import 'jquery-ui/ui/widgets/slider';
// import 'jquery-ui/themes/base/slider.css';
import 'jquery-ui/ui/widgets/sortable';
// import 'jquery-ui/themes/base/sortable.css';
import 'jquery-ui/ui/widgets/button';
// import 'jquery-ui/themes/base/button.css';
import 'jquery-ui/ui/effects/effect-blind';
// import 'jquery-ui/themes/base/checkboxradio.css';
// import 'jquery-ui/ui/widgets/checkboxradio';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faMapMarkerAlt,
	faMapMarkedAlt,
	faRuler,
	faEdit,
	faLayerGroup,
	faWrench,
	IconDefinition
} from '@fortawesome/free-solid-svg-icons';


const jaiabot_icon = require('../icons/jaiabot.png')

import {BotDetailsComponent, HubDetailsComponent, DetailsExpandedState} from './Details'
import { jaiaAPI, JaiaAPI } from '../../common/JaiaAPI';

import tooltips from '../libs/tooltips'

// jQuery UI touch punch
import punchJQuery from '../libs/jquery.ui.touch-punch'

import { error, success, warning, info} from '../libs/notifications';

// Don't use any third party css exept reset-css!
import 'reset-css';
// import 'ol-layerswitcher/src/ol-layerswitcher.css';
import '../style/CommandControl.less';
import { transform } from 'ol/proj';

const rallyPointRedIcon = require('../icons/rally-point-red.svg')
const rallyPointGreenIcon = require('../icons/rally-point-green.svg')
const missionOrientationIcon = require('../icons/compass.svg')
const goToRallyGreen = require('../icons/go-to-rally-point-green.png')
const goToRallyRed = require('../icons/go-to-rally-point-red.png')

import { LoadMissionPanel } from './LoadMissionPanel'
import { SaveMissionPanel } from './SaveMissionPanel'
import SoundEffects from './SoundEffects'
import { persistVisibility } from './VisibleLayerPersistance'

import { KMZ } from './KMZ'
import { createChartLayerGroup, gebcoLayer } from './ChartLayers';
import { createBaseLayerGroup } from './BaseLayers'

import { BotListPanel } from './BotListPanel'
import { PodMission } from './Missions';
import { fromLonLat } from 'ol/proj.js';
import { Goal, HubStatus, BotStatus, TaskType, GeographicCoordinate, MissionPlan, CommandType, MissionStart, MovementType, Command } from './gui/JAIAProtobuf'
import { MapBrowserEvent, MapEvent } from 'ol'
import { StyleFunction } from 'ol/style/Style'
import BaseEvent from 'ol/events/Event'
import { EventsKey } from 'ol/events'
import { Feature as TFeature, Units } from '@turf/turf'
import TileLayer from 'ol/layer/Tile'
import { PodStatus } from './PortalStatus'
import * as Styles from './gui/Styles'
import { DragAndDropEvent } from 'ol/interaction/DragAndDrop'
import { createBotFeature } from './gui/BotFeature'
import { createHubFeature } from './gui/HubFeature'

// Must prefix less-vars-loader with ! to disable less-loader, otherwise less-vars-loader will get JS (less-loader
// output) as input instead of the less.
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
const lessVars = require('!less-vars-loader?camelCase,resolveVariables!../style/CommandControl.less');

const COLOR_SELECTED = lessVars.selectedColor;

punchJQuery($);
// jqueryDrawer($);

// Sorry, map is a global because it really gets used from everywhere
let map: OlMap
const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = (input: number[]) => getTransform(equirectangular, mercator)(input, undefined, undefined)
const mercator_to_equirectangular = (input: number[]) => getTransform(mercator, equirectangular)(input, undefined, undefined)

const viewportDefaultPadding = 100;
const sidebarInitialWidth = 0;

const POLLING_INTERVAL_MS = 300;

const MAX_GOALS = 30;

// Store Previous Mission History
let previous_mission_history: any;

String.prototype.endsWith = function(suffix) {
	return this.slice(this.length - suffix.length, this.length) == suffix
}

// ===========================================================================================================================

// ===========================================================================================================================

var mapSettings = GlobalSettings.mapSettings

interface Props {

}

enum Mode {
	NONE = '',
	MISSION_PLANNING = 'missionPlanning',
	SET_HOME = 'setHome',
	SET_RALLY_POINT_GREEN = "setRallyPointGreen",
	SET_RALLY_POINT_RED = "setRallyPointRed"
}

interface MissionParams {
	mission_type: 'editing' | 'polygon-grid' | 'lines' | 'exclusions'
	num_bots: number,
	num_goals: number,
	spacing: number,
	orientation: number,
	rally_spacing: number,
	sp_area: number,
	sp_perimeter: number,
	sp_rally_start_dist: number,
	sp_rally_finish_dist: number,
	selected_bots: number[],
	use_max_length: boolean
}

interface HubOrBot {
	type: 'hub' | 'bot',
	id: number
}

interface State {
	engineeringPanelActive: boolean,
	mode: Mode,
	currentInteraction: Interaction | null,
	selectedBotsFeatureCollection: OlCollection<OlFeature>,
	lastBotCount: number,
	botExtents: {[key: number]: number[]},
	trackingTarget: number | string,
	viewportPadding: number[],
	measureFeature?: OlFeature,
	measureActive: boolean,
	homeLocation?: GeographicCoordinate,
	rallyPointGreenLocation?: GeographicCoordinate,
	rallyPointRedLocation?: GeographicCoordinate,
	mapLayerActive: boolean,
	missionParams: MissionParams,
	missionPlans?: PodMission,
	missionPlanningGrid?: any,
	missionPlanningLines?: any,
	missionPlanningFeature?: OlFeature<Geometry>,
	missionBaseGoal: Goal,
	missionBaseStyle?: any,
	surveyPolygonFeature?: OlFeature<Geometry>,
	surveyPolygonActive: boolean,
	surveyPolygonGeoCoords?: Coordinate[],
	surveyPolygonCoords?: LineString,
	surveyPolygonChanged: boolean,
	surveyExclusions?: number[][],
	selectedFeatures?: OlCollection<OlFeature>,
	detailsBoxItem?: HubOrBot,
	detailsExpanded: DetailsExpandedState,
	goalBeingEditedBotId?: number,
	goalBeingEditedGoalIndex?: number,
	goalBeingEdited?: Goal,
	loadMissionPanel?: ReactElement,
	saveMissionPanel?: ReactElement,
	disconnectionMessage?: string,
}

export default class CommandControl extends React.Component {

	props: Props
	state: State

	mapDivId = `map-${Math.round(Math.random() * 100000000)}`
	api = jaiaAPI
	podStatus: PodStatus = {
		bots: {},
		hubs: {},
		controllingClientId: null
	}
	missions: PodMission = {}
	undoMissionsStack: PodMission[] = []
	flagNumber = 1
	surveyExclusionsStyle?: StyleFunction = null
	chartLayerGroup = createChartLayerGroup()
	measureLayer: OlVectorLayer<OlVectorSource>
	graticuleLayer: OlGraticule

	botsLayerCollection: OlCollection<OlVectorLayer<OlVectorSource>> = new OlCollection([], { unique: true })
	botsLayerGroup: OlLayerGroup = new OlLayerGroup({
		layers: this.botsLayerCollection
	})

	hubsLayerCollection: OlCollection<OlVectorLayer<OlVectorSource>> = new OlCollection([], { unique: true })
	hubsLayerGroup: OlLayerGroup = new OlLayerGroup({
		layers: this.hubsLayerCollection
	})

	dragAndDropInteraction = new DragAndDropInteraction({
		formatConstructors: [KMZ, GPX, GeoJSON, IGC, KML, TopoJSON],
	})
	dragAndDropVectorLayer = new OlVectorLayer()

	coordinate_to_location_transform = equirectangular_to_mercator

	measureInteraction: OlDrawInteraction
	surveyPolygonInteraction: OlDrawInteraction
	surveyLinesInteraction: OlDrawInteraction
	surveyExclusionsInteraction: OlDrawInteraction

	missionLayer: OlVectorLayer<OlVectorSource>

	activeMissionLayer: OlVectorLayer<OlVectorSource>
	missionPlanningLayer: OlVectorLayer<OlVectorSource>
	exclusionsLayer: OlVectorLayer<OlVectorSource>
	missionLayerGroup: OlLayerGroup

	measurementLayerGroup: OlLayerGroup
	baseLayerGroup: OlLayerGroup

	timerID: NodeJS.Timer

	oldPodStatus?: PodStatus

	constructor(props: Props) {
		super(props)

		this.state = {
			// User interaction modes
			mode: Mode.NONE,
			lastBotCount: 0,
			currentInteraction: null,
			// Map layers
			selectedBotsFeatureCollection: new OlCollection([], { unique: true }),
			// incoming data
			botExtents: {},
			trackingTarget: null,
			viewportPadding: [
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding + sidebarInitialWidth
			],
			measureFeature: null,
			measureActive: false,
			homeLocation: null,
			rallyPointGreenLocation: null,
			rallyPointRedLocation: null,
			missionParams: {
				'mission_type': 'editing',
				'num_bots': 4,
				'num_goals': 12,
				'spacing': 30,
				'orientation': 0,
				'rally_spacing': 20,
				'sp_area': 0,
				'sp_perimeter': 0,
				'sp_rally_start_dist': 0,
				'sp_rally_finish_dist': 0,
				'selected_bots': [],
				'use_max_length': true
			},
			missionPlans: null,
			missionPlanningGrid: null,
			missionPlanningLines: null,
			missionPlanningFeature: null,
			missionBaseGoal: {},
			missionBaseStyle: null,
			surveyPolygonFeature: null,
			surveyPolygonActive: false,
			surveyPolygonGeoCoords: null,
			surveyPolygonCoords: null,
			surveyPolygonChanged: false,
			surveyExclusions: null,
			selectedFeatures: null,
			// noaaEncSource: new TileArcGISRest({ url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer' }),
			detailsBoxItem: null,
			detailsExpanded: {
				quickLook: true,
				commands: false,
				health: false,
				gps: false,
				imu: false,
				sensor: false,
				power: false,
			},
			mapLayerActive: false, 
			engineeringPanelActive: false
		};

		// Measure tool

		this.measureLayer = new OlVectorLayer({
			source: new OlVectorSource(),
			style: new OlStyle({
				fill: new OlFillStyle({
					color: 'rgba(255, 255, 255, 0.2)'
				}),
				stroke: new OlStrokeStyle({
					color: '#ffcc33',
					width: 2
				}),
				image: new OlCircleStyle({
					radius: 7,
					fill: new OlFillStyle({
						color: '#ffcc33'
					})
				})
			})
		});

		this.graticuleLayer = new OlGraticule({
			// the style to use for the lines, optional.
			strokeStyle: new OlStrokeStyle({
				color: 'rgb(0,0,0)',
				width: 2,
				lineDash: [0.5, 4],
			}),
			zIndex: 30,
			opacity: 0.8,
			showLabels: true,
			wrapX: false,
		});

		map = new OlMap({
			interactions: defaultInteractions().extend([this.pointerInteraction(), this.selectInteraction(), this.translateInteraction(), this.dragAndDropInteraction]),
			layers: this.createLayers(),
			controls: [
				new OlZoom(),
				new OlRotate(),
				new OlScaleLine({ units: 'metric' }),
				new OlMousePosition({
					coordinateFormat: OlCreateStringXY(6),
					projection: equirectangular,
				}),
				new OlAttribution({
					collapsible: false
				})
			],
			view: new OlView({
				projection: mercator,
				center: [0, 0],
				zoom: 0,
				maxZoom: 24
			}),
			maxTilesLoading: 64,
			moveTolerance: 20
		});

		// Set the map for the TaskData object, so it knows where to put popups, and where to get the projection transform
		taskData.map = map

		this.coordinate_to_location_transform = (coordinate: number[]) => {
			return getTransform(map.getView().getProjection(), equirectangular)(coordinate, undefined, undefined)
		}

		this.measureInteraction = new OlDrawInteraction({
			source: new OlVectorSource(),
			type: 'LineString',
			style: new OlStyle({
				fill: new OlFillStyle({
					color: 'rgba(255, 255, 255, 0.2)'
				}),
				stroke: new OlStrokeStyle({
					color: 'rgba(0, 0, 0, 0.5)',
					lineDash: [10, 10],
					width: 2
				}),
				image: new OlCircleStyle({
					radius: 5,
					stroke: new OlStrokeStyle({
						color: 'rgba(0, 0, 0, 0.7)'
					}),
					fill: new OlFillStyle({
						color: 'rgba(255, 255, 255, 0.2)'
					})
				})
			})
		});

		let listener: EventsKey

		this.measureInteraction.on(
			'drawstart',
			(evt: DrawEvent) => {
				this.setState({ measureFeature: evt.feature });

				listener = evt.feature.getGeometry().on('change', (evt2) => {
					const geom = evt2.target;
					// tooltipCoord = geom.getLastCoordinate();
					$('#measureResult').text(CommandControl.formatLength(geom));
				});
			}
		);

		this.measureInteraction.on(
			'drawend',
			() => {
				this.setState({ measureActive: false, measureFeature: null });
				OlUnobserveByKey(listener);
				this.changeInteraction();
			}
		);

		let surveyPolygonSource = new OlVectorSource({ wrapX: false });

		this.surveyPolygonInteraction = new OlDrawInteraction({
			// features: map.missionPlanningLayer.features,
			//source: surveyPolygonSource,
			stopClick: true,
			minPoints: 3,
			clickTolerance: 10,
			// finishCondition: event => {
			// 	return this.surveyPolygonInteraction.finishCoordinate_ === this.surveyPolygonInteraction.sketchCoords_[0][0];
			// },
			type: 'Polygon',
			style: new OlStyle({
				fill: new OlFillStyle({
					color: 'rgba(255, 255, 255, 0.2)'
				}),
				stroke: new OlStrokeStyle({
					color: 'rgba(0, 0, 0, 0.5)',
					lineDash: [10, 10],
					width: 2
				}),
				image: new OlCircleStyle({
					radius: 5,
					stroke: new OlStrokeStyle({
						color: 'rgba(0, 0, 0, 0.7)'
					}),
					fill: new OlFillStyle({
						color: 'rgba(255, 255, 255, 0.2)'
					})
				})
			})
		});

		let surveyPolygonlistener: EventsKey

		this.surveyPolygonInteraction.on(
			'drawstart',
			(evt: DrawEvent) => {
				this.setState({
					surveyPolygonChanged: true,
					mode: Mode.MISSION_PLANNING,
					missionPlanningFeature: null
				});
				this.updateMissionLayer();

				surveyPolygonlistener = evt.feature.on('change', (evt2: BaseEvent) => {
					const geom1 = evt2.target;

					const format = new GeoJSON();
					const turfPolygon = format.writeFeatureObject(geom1) as any

					if (turfPolygon.geometry.coordinates[0].length > 500) {

						let cellSide = this.state.missionParams.spacing;

						let options = {units: 'meters' as Units, mask: turf.toWgs84(turfPolygon)};

						let turfPolygonBbox = turf.bbox(turf.toWgs84(turfPolygon));

						let missionPlanningGridTurf = turf.pointGrid(turfPolygonBbox, cellSide, options);

						if (missionPlanningGridTurf.features.length > 0) {

							let missionPlanningGridTurfCentroid = turf.centroid(missionPlanningGridTurf);
							let optionsRotate = {pivot: missionPlanningGridTurfCentroid};
							let missionPlanningGridTurfRotated = turf.transformRotate(missionPlanningGridTurf, this.state.missionParams.orientation, optionsRotate);

							if (missionPlanningGridTurfRotated.features.length > 0) {
								// const missionPlanningGridOl = format.readFeatures(missionPlanningGridTurf, {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
								let turfCombined = turf.combine(missionPlanningGridTurfRotated);

								const missionPlanningGridOl = format.readFeature(turfCombined.features[0].geometry, {
									dataProjection: 'EPSG:4326',
									featureProjection: 'EPSG:3857'
								});

								let optionsMissionLines = {units: 'meters' as Units};
								let bot_dict_length = Object.keys(this.podStatus.bots).length
								let bot_list = Array.from(Array(bot_dict_length).keys());
								let missionRhumbDestPoint = turf.rhumbDestination(missionPlanningGridTurfCentroid, this.state.missionParams.spacing * bot_dict_length, this.state.missionParams.orientation, optionsMissionLines);

								let centerLine = turf.lineString([missionPlanningGridTurfCentroid.geometry.coordinates, missionRhumbDestPoint.geometry.coordinates]);

								let lineSegments: any[] = [];
								let firstDistance = 0;
								let nextDistance = this.state.missionParams.spacing;
								bot_list.forEach(bot => {
									let ls = turf.lineSliceAlong(centerLine, firstDistance, nextDistance, {units: 'meters'});
									lineSegments.push(ls);
									firstDistance = nextDistance;
									nextDistance = nextDistance + this.state.missionParams.spacing;
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
								bot_list.forEach(bot => {
									ol = turf.lineOffset(ol, this.state.missionParams.spacing, {units: 'meters'});
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

								this.setState({
									missionPlanningLines: b,
									missionPlanningGrid: d
								})
							}
						}

						// tooltipCoord = geom.getLastCoordinate();
						// $('#surveyPolygonResult').text(CommandControl.formatLength(geom));
					}

					let spArea = Math.trunc(turf.area(turf.toWgs84(turfPolygon))/1000000*100)/100;
					let spPerimeter = Math.trunc(turf.length(turf.toWgs84(turfPolygon))*100)/100
					if (spArea !== undefined && spPerimeter !== undefined) {
						this.state.missionParams.sp_area = spArea
						this.state.missionParams.sp_perimeter = spPerimeter;
					}

					$('#missionStatArea').text(this.state.missionParams.sp_area);
					$('#missionStatPerimeter').text(this.state.missionParams.sp_perimeter);
					$('#missionStatOrientation').text(this.state.missionParams.orientation);
					$('#missionStatRallyStartDistance').text(this.state.missionParams.sp_rally_start_dist);
					$('#missionStatRallyFinishDistance').text(this.state.missionParams.sp_rally_finish_dist);

					this.updateMissionLayer();

					// if (turfPolygon.geometry.coordinates[0].length > 5) {
					// 	let geo_geom = geom1.getGeometry();
					// 	geo_geom.transform("EPSG:3857", "EPSG:4326")
					// 	let surveyPolygonGeoCoords = geo_geom.getCoordinates()
					//
					// 	this.setState({
					// 		// missionPlanningGrid: missionPlanningGridOl.getGeometry(),
					// 		// missionPlanningLines: missionPlanningLinesOl.getGeometry(),
					// 		surveyPolygonGeoCoords: surveyPolygonGeoCoords,
					// 		surveyPolygonCoords: geo_geom,
					// 		surveyPolygonChanged: true
					// 	});
					// 	this.updateMissionLayer();
					// }


				});
				this.updateMissionLayer();
			}
		);

		this.surveyPolygonInteraction.on(
			'drawend',
			(evt: DrawEvent) => {
				this.setState({
					surveyPolygonChanged: true,
					mode: Mode.MISSION_PLANNING,
					missionPlanningFeature: evt.feature
				});
				this.updateMissionLayer();

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

				let geo_geom = (evt.feature as OlFeature<LineString>).getGeometry();
				geo_geom.transform("EPSG:3857", "EPSG:4326")
				let surveyPolygonGeoCoords = geo_geom.getCoordinates()

				this.setState({
					surveyPolygonFeature: evt.feature,
					surveyPolygonGeoCoords: surveyPolygonGeoCoords,
					surveyPolygonCoords: geo_geom,
					surveyPolygonChanged: true,
					missionPlanningFeature: geom1
				})

				// console.log(Math.trunc(turf.convertArea(turf.area(turf.toWgs84(turfPolygon))*100, 'meters', 'kilometers'))/100);

				$('#missionStatArea').text(this.state.missionParams.sp_area);
				$('#missionStatPerimeter').text(this.state.missionParams.sp_perimeter);
				$('#missionStatOrientation').text(this.state.missionParams.orientation);
				$('#missionStatRallyStartDistance').text(this.state.missionParams.sp_rally_start_dist);
				$('#missionStatRallyFinishDistance').text(this.state.missionParams.sp_rally_finish_dist);

				this.updateMissionLayer();
				OlUnobserveByKey(surveyPolygonlistener);



				// map.changed();
				map.renderSync();
				// map.updateSize();
			}
		);

		// Callbacks
		this.changeInteraction = this.changeInteraction.bind(this);

		this.setViewport = this.setViewport.bind(this);
		this.centerOn = this.centerOn.bind(this);
		this.fit = this.fit.bind(this);

		this.sendStop = this.sendStop.bind(this);

		// center persistence
		map.getView().setCenter(mapSettings.center)

		map.getView().on('change:center', function() {
			mapSettings.center = map.getView().getCenter()
			Save(mapSettings)
		})

		// zoomLevel persistence
		map.getView().setZoom(mapSettings.zoomLevel)

		map.getView().on('change:resolution', function() {
			mapSettings.zoomLevel = map.getView().getZoom()
			Save(mapSettings)
		})

		// rotation persistence
		map.getView().setRotation(mapSettings.rotation)

		map.getView().on('change:rotation', function() {
			mapSettings.rotation = map.getView().getRotation()
			Save(mapSettings)
		})

	}

	clearMissionPlanningState() {
		this.setState({
			surveyPolygonActive: false,
			mode: '',
			surveyPolygonChanged: false,
			missionPlanningGrid: null,
			missionPlanningLines: null
		});
		this.updateMissionLayer();
	}

	genMission() {
		this.generateMissions();
	}

	changeMissionBotList() {
		console.log('changeMissionBotList');
	}

	changeMissionMode() {
		// console.log('changeMissionMode');
		if (this.state.missionParams.mission_type === 'polygon-grid')
			this.changeInteraction(this.surveyPolygonInteraction, 'crosshair');
		if (this.state.missionParams.mission_type === 'editing')
			this.changeInteraction(this.selectInteraction(), 'grab');
		if (this.state.missionParams.mission_type === 'lines')
			this.changeInteraction(this.surveyLinesInteraction, 'crosshair');
		if (this.state.missionParams.mission_type === 'exclusions')
			this.changeInteraction(this.surveyExclusionsInteraction, 'crosshair');
	}

	getMissionState() {
		return this.state.missionParams
	}

	setMissionState(missionParams: any) {
		this.setState({
			missionParams: missionParams
		})
	}

	createLayers() {
		this.missionLayer = new OlVectorLayer();
		this.activeMissionLayer = new OlVectorLayer({
			properties: {
				title: 'Active Missions',
			},
			source: new OlVectorSource(),
			zIndex: 999,
			opacity: 0.5
		})

		this.missionPlanningLayer = new OlVectorLayer({
			properties: { 
				name: 'missionPlanningLayer',
				title: 'Mission Planning'
			},
		});
		this.exclusionsLayer = new OlVectorLayer({
			properties: { 
				name: 'exclusionsLayer',
				title: 'Mission Exclusion Areas'
			}
		});

		this.missionLayerGroup = new OlLayerGroup({
			properties: {
				title: 'Mission',
				fold: 'close',
			},
			layers: [
				this.activeMissionLayer,
				this.missionPlanningLayer,
				this.exclusionsLayer,
			]
		})

		this.measurementLayerGroup = new OlLayerGroup({
			properties: { 
				title: 'Measurements',
				fold: 'close',
			},
			layers: [
				taskData.getContourLayer(),
				taskData.getTaskPacketDiveLayer(),
				taskData.getTaskPacketDriftLayer(),
				taskData.getTaskPacketDiveBottomLayer(),
				taskData.getTaskPacketDiveInfoLayer(),
				taskData.getTaskPacketDriftInfoLayer(),
				taskData.getTaskPacketDiveBottomInfoLayer(),
				taskData.taskPacketInfoLayer
			]
		})

		this.baseLayerGroup = createBaseLayerGroup()

		let layers = [
			this.baseLayerGroup,
			this.chartLayerGroup,
			this.measurementLayerGroup,
			this.graticuleLayer,
			this.measureLayer,
			this.missionLayer,
			this.missionLayerGroup,
			this.hubsLayerGroup,
			this.botsLayerGroup,
			this.dragAndDropVectorLayer,
		]

		// console.log(layers)

		return layers
	}

	componentDidMount() {

		let test = "test"

		//const backgroundColor = 0x000000;

		/*////////////////////////////////////////*/

		/*var renderCalls = [];
		function render() {
			requestAnimationFrame(render);
			renderCalls.forEach((callback) => {
				callback();
			});
		}
		render();*/

		/*////////////////////////////////////////*/

		/*var scene = new THREE.Scene();

		var camera = new THREE.PerspectiveCamera(
			80,
			window.innerWidth*0.1 / window.innerHeight*0.1,
			0.1,
			800
		);
		camera.position.set(5, 5, 5);

		var renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth*0.1, window.innerHeight*0.1);
		renderer.setClearColor(backgroundColor); //0x );

		renderer.toneMapping = THREE.LinearToneMapping;
		renderer.toneMappingExposure = Math.pow(0.94, 5.0);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFShadowMap;

		window.addEventListener(
			"resize",
			function () {
				camera.aspect = window.innerWidth*0.1 / window.innerHeight*0.1;
				camera.updateProjectionMatrix();
				renderer.setSize(window.innerWidth*0.1, window.innerHeight*0.1);
			},
			false
		);

		document.getElementById('jaiabot3d').appendChild(renderer.domElement);

		function renderScene() {
			renderer.render(scene, camera);
		}
		renderCalls.push(renderScene);*/

		/* ////////////////////////////////////////////////////////////////////////// */

		/*var controls = new OrbitControls(camera, renderer.domElement);
		controls.rotateSpeed = 0.3;
		controls.zoomSpeed = 0.9;

		controls.minDistance = 3;
		controls.maxDistance = 20;

		controls.minPolarAngle = 0; // radians
		controls.maxPolarAngle = Math.PI / 2; // radians

		controls.enableDamping = true;
		controls.dampingFactor = 0.05;

		renderCalls.push(function () {
			controls.update();
		});*/

		/* ////////////////////////////////////////////////////////////////////////// */

		/*var light = new THREE.PointLight(0xffffcc, 5, 200);
		light.position.set(4, 30, -20);
		scene.add(light);

		var light2 = new THREE.AmbientLight(0x20202a, 8, 100);
		light2.position.set(30, -10, 30);
		scene.add(light2);*/

		/* ////////////////////////////////////////////////////////////////////////// */
		/*async function run() {
			try {
				var loader = new GLTFLoader();
				loader.crossOrigin = true;
				loader.load(
					"JaiaBotRed.glb",
					function (data) {
						var object = data.scene;
						object.position.set(0, 0, 0);
						object.scale.set(5, 5, 5);

						scene.add(object);
					}
				);

				// add texture
				var texture, material, plane;

				texture = new THREE.TextureLoader().load("bg.png");
				texture.wrapT = THREE.RepeatWrapping;

				material = new THREE.MeshLambertMaterial({ map: texture });
				plane = new THREE.Mesh(new THREE.PlaneGeometry(52, 38), material);
				plane.doubleSided = true;
				plane.position.z = -3;
				// plane.rotation.y = Math.PI / 2;
				plane.rotation.z = 0; // Not sure what this number represents.
				scene.add(plane);

				// texture.wrapT = THREE.LoopRepeat; // This doesn't seem to work;
			} catch (e) {
				console.log(e);
			}
		}

		run();*/

		map.setTarget(this.mapDivId);

		const viewport = document.getElementById(this.mapDivId);
		map.getView().setMinZoom(Math.ceil(Math.LOG2E * Math.log(viewport.clientWidth / 256)));

		const us = this;


		this.timerID = setInterval(() => this.pollPodStatus(), 0);

		($('.panel > h2') as any).disableSelection();

		OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'), {});

		($('button') as any).disableSelection();

		tooltips();

		($('#mapLayers') as any).hide('blind', { direction: 'right' }, 0);

		// Hotkeys
		function KeyPress(e: KeyboardEvent) {
			let target = e.target as any

			switch (target.tagName.toLowerCase()) {
				case "input":
				case "textarea":
				// ...and so on for other elements you want to exclude;
				// list of current elements here: http://www.w3.org/TR/html5/index.html#elements-1
				  break;
				default:
					// BotDetails number key shortcuts
					if (e.code.startsWith('Digit')) {
						const botId = Number(e.code[5])

						if (e.shiftKey) {
							this.api.postCommand({
								bot_id: botId,
								type: "STOP"
							})

							info("Stopped bot " + botId)

							return
						}

						this.toggleBot(botId)
						return
					}

				// Undo
				if (e.keyCode == 90 && e.ctrlKey) {
					this.restoreUndo()
				}
			}
		}

		document.onkeydown = KeyPress.bind(this)

		this.state.missionBaseGoal.task = {
			type: TaskType.DIVE,
			dive: {
				max_depth: 10,
				depth_interval: 10,
				hold_time: 1
			},
			surface_drift: {
				drift_time: 10
			}
		}

		map.on('dblclick', function (evt) {
			document.getElementById('layerinfo').innerHTML = '';
			const viewResolution = /** @type {number} */ (map.getView().getResolution());

			let theSource = gebcoLayer.getSource()

			const url = theSource.getFeatureInfoUrl(
				evt.coordinate,
				viewResolution,
				'EPSG:4326',
				{
					'INFO_FORMAT': 'text/html',
					'VERSION': '1.3.0',
					'LAYERS': 'GEBCO_LATEST_2_sub_ice_topo'
				}
			);
			if (url) {
				fetch(url)
					.then((response) => response.text())
					.then((html) => {
						document.getElementById('layerinfo').innerHTML = html;
					});
			}
		});

		// Set addFeatures interaction
		this.dragAndDropInteraction.on('addfeatures', function (event: DragAndDropEvent) {
			const vectorSource = new OlVectorSource({
				features: event.features as any,
			});
			map.addLayer(
				new OlVectorLayer({
					source: vectorSource,
					zIndex: 2000
				})
			);
			map.getView().fit(vectorSource.getExtent());
		});

		/* ////////////////////////////////////////////////////////////////////////// */

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

		let surveyExclusionsSource = new OlVectorSource({ wrapX: false });
		this.surveyExclusionsInteraction = new OlDrawInteraction({
			source: surveyExclusionsSource,
			stopClick: true,
			minPoints: 3,
			clickTolerance: 10,
			type: 'Polygon',
			style: surveyExclusionsStyle
		})

		let surveyExclusionslistener: EventsKey
		this.surveyExclusionsInteraction.on(
			'drawstart',
			(evt: DrawEvent) => {
				this.setState({
					surveyExclusions: null
				})
				this.updateMissionLayer();

				// Show the preview of the survey
				surveyLineslistener = evt.feature.on('change', (evt2) => {
					this.updateMissionLayer();
					// console.log('surveyExclusions changed...')
				})
			}
		);

		this.surveyExclusionsInteraction.on(
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

				this.exclusionsLayer.setSource(vectorSource);
				this.exclusionsLayer.setZIndex(5000);

				this.setState({
					surveyExclusions: turf.coordAll(turf.polygon(geometry.getCoordinates()))
				})
				OlUnobserveByKey(surveyExclusionslistener);
			}
		);

		// Survey planning using lines
		let surveyLineStyle = function(feature: OlFeature<LineString>) {

			let rotationAngle = 0;
			let rhumbDist = 0;
			let rhumbHomeDist = 0;
			let stringCoords = feature.getGeometry().getCoordinates();
			let coords = stringCoords.slice(-2);
			if (
				coords[1][0] == coords[0][0] &&
				coords[1][1] == coords[0][1] &&
				stringCoords.length > 2
			) {
				coords = stringCoords.slice(-3, -1);
			}

			let lineStyle = new OlStyle({
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
				image: new OlIcon({
					src: missionOrientationIcon,
					scale: [0.5, 0.5]
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

			iconStyle.setGeometry(new OlPoint(coords[0]));
			iconStyle
				.getImage()
				.setRotation(
					Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1])
				);
			let rotAngRadians = Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]);

			rotationAngle = Number((Math.trunc(turf.radiansToDegrees(rotAngRadians)*100)/100).toFixed(2));
			if (rotationAngle < 0) {
				rotationAngle = rotationAngle + 360;
			}

			const { homeLocation } = us.state;
			if (stringCoords[0].length >= 2) {
				let previousIndex = stringCoords.length - 2;
				let nextIndex = stringCoords.length - 1;
				rhumbDist = turf.rhumbDistance(turf.toWgs84(turf.point(stringCoords[previousIndex])), turf.toWgs84(turf.point(stringCoords[nextIndex])), {units: 'kilometers'});
				let rhumbDistString = Number(rhumbDist.toFixed(2)).toString();
				if (homeLocation !== null) {
					rhumbHomeDist = turf.rhumbDistance(turf.toWgs84(turf.point(stringCoords[nextIndex])), turf.point([homeLocation.lon, homeLocation.lat]), {units: 'kilometers'});
					let rhumbHomeDistString = Number(rhumbHomeDist.toFixed(2)).toString();
				}
			}

			us.updateMissionLayer();

			return [lineStyle, iconStyle];
		};

		let surveyLinesSource = new OlVectorSource({ wrapX: false });
		this.surveyLinesInteraction = new OlDrawInteraction({
			source: surveyLinesSource,
			stopClick: true,
			minPoints: 2,
			maxPoints: 2,
			clickTolerance: 10,
			type: 'LineString',
			style: surveyLineStyle
		})

		let surveyLineslistener: EventsKey

		this.surveyLinesInteraction.on(
			'drawstart',
			(evt: DrawEvent) => {
				this.setState({
					missionPlanningFeature: null
				})
				this.updateMissionLayer();

				// Show the preview of the survey
				surveyLineslistener = evt.feature.on('change', (evt2) => {
					// console.log('** START ********* ON CHANGE *************************')
					const geom1 = evt2.target;
					// console.log('geom1');
					// console.log(geom1);

					const format = new GeoJSON();

					let { missionParams } = this.state;

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

						let bot_list = Object.keys(this.podStatus.bots);

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
								if (this.state.surveyExclusions) {
									let alongPointsBeforeExclusion = turf.coordAll(turf.cleanCoords(turf.multiPoint(round(turf.coordAll(turf.explode(offsetLine)), 7))))
									let alongPointsAfterExclusion: number[][] = []
									alongPointsBeforeExclusion.forEach(point => {
										// console.log('this.state.surveyExclusions');
										let se = turf.coordAll(turf.toWgs84(turf.multiPoint(this.state.surveyExclusions)));
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

							missionParams.sp_rally_start_dist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[0], turf.point([this.state.rallyPointGreenLocation.lon, this.state.rallyPointGreenLocation.lat])), 2)
							missionParams.sp_rally_finish_dist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[1], turf.point([this.state.rallyPointRedLocation.lon, this.state.rallyPointRedLocation.lat])), 2)

							this.setState({
								missionPlanningLines: alongLines,
								missionPlanningGrid: alongPoints,
								missionParams: missionParams
							})
							this.updateMissionLayer();
						}

						// Metadata/Stats
						$('#missionStatArea').text(this.state.missionParams.sp_area);
						$('#missionStatPerimeter').text(this.state.missionParams.sp_perimeter);
						$('#missionStatOrientation').text(this.state.missionParams.orientation);
						$('#missionStatRallyStartDistance').text(this.state.missionParams.sp_rally_start_dist);
						$('#missionStatRallyFinishDistance').text(this.state.missionParams.sp_rally_finish_dist);

						// console.log('** END ********* ON CHANGE *************************')
					}
				})
			}
		);

		this.surveyLinesInteraction.on(
			'drawend',
			(evt: DrawEvent) => {
				// console.log('surveyLinesInteraction drawend');
				// this.surveyLinesInteraction.finishDrawing();
				// this.updateMissionLayer();
				// console.log(evt);
				// console.log(map);

				this.setState({
					missionPlanningFeature: evt.feature
				})

				// console.log(this.surveyLinesInteraction);
				// console.log(this.surveyLinesInteraction.finishCoordinate_);
				// console.log(this.surveyLinesInteraction.sketchCoords_);
				this.updateMissionLayer();
				OlUnobserveByKey(surveyLineslistener);

				// map.changed();
				// map.renderSync();
				// map.updateSize();
			}
		);

		info('Welcome to JaiaBot Command & Control!');
	}

	componentDidUpdate(prevProps: Props, prevState: State, snapshot: any) {
		// TODO move map-based rendering here
		// Here we can check the previous state against the current state and update the map
		// layers to reflect changes that we can't handle in render() directly.
		// Note that calling setState() here will cause another cycle, beware of infinite loops
		/* Need to detect when an input field is rendered, then call this on it:
				This will make the keyboard "go" button close the keyboard instead of doing nothing.
		$('input').keypress(function(e) {
				let code = (e.keyCode ? e.keyCode : e.which);
				if ( (code==13) || (code==10))
						{
						jQuery(this).blur();
						return false;
						}
		});
		*/
	}

	componentWillUnmount() {
		clearInterval(this.timerID)
	}

	getLiveLayerFromHubId(hub_id: number) {
		const hubsLayerCollection = this.hubsLayerCollection
		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < hubsLayerCollection.getLength(); i++) {
			const layer = hubsLayerCollection.item(i);
			if (layer.get('hub_id') === hub_id) {
				return layer;
			}
		}

		const hubLayer = new OlVectorLayer({
			properties: {
				name: hub_id,
				title: hub_id,
				hub_id: hub_id
			},
			source: new OlVectorSource({
				wrapX: false,
				features: new OlCollection([], { unique: true })
			})
		});

		hubsLayerCollection.push(hubLayer);

		OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'), {});

		return hubsLayerCollection.item(hubsLayerCollection.getLength() - 1);
	}

	getLiveLayerFromBotId(bot_id: number) {
		const botsLayerCollection = this.botsLayerCollection

		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < botsLayerCollection.getLength(); i++) {
			const layer = botsLayerCollection.item(i);
			if (layer.get('bot_id') === bot_id) {
				return layer;
			}
		}

		const botLayer = new OlVectorLayer({
			properties: {
				name: bot_id,
				title: bot_id,
				bot_id: bot_id
			},
			source: new OlVectorSource({
				wrapX: false,
				features: new OlCollection([], { unique: true })
			})
		});

		botsLayerCollection.push(botLayer);

		OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'), {});
		// $('input').checkboxradio();

		return botsLayerCollection.item(botsLayerCollection.getLength() - 1);
	}

	changeInteraction(newInteraction: Interaction = null, cursor = '') {
		const { currentInteraction } = this.state;
		if (currentInteraction !== null) {
			map.removeInteraction(currentInteraction);
		}
		if (newInteraction !== null) {
			map.addInteraction(newInteraction);
			this.setState({ currentInteraction: newInteraction });
		}
		map.getTargetElement().style.cursor = cursor;
	}

	defaultInteraction() {
		this.changeInteraction();
	}


	setViewport(dims: number[]) {
		const { viewportPadding } = this.state;
		this.setState({
			viewportPadding: [
				viewportDefaultPadding + dims[0],
				viewportDefaultPadding + dims[1],
				viewportDefaultPadding + dims[2],
				viewportDefaultPadding + dims[3]
			]
		});
	}

	centerOn(coords: number[], stopTracking = false, firstMove = false) {
		if (isNaN(coords[0]) || isNaN(coords[1])) {
			return
		}

		if (stopTracking) {
			this.trackBot(null);
		}

		const floatCoords = [coords[0], coords[1]];
		const { viewportPadding } = this.state;
		const size = map.getSize();
		const viewportCenterX = (size[0] - viewportPadding[1] - viewportPadding[3]) / 2 + viewportPadding[3];
		const viewportCenterY = (size[1] - viewportPadding[0] - viewportPadding[2]) / 2 + viewportPadding[0];
		const viewportCenter = [viewportCenterX, viewportCenterY];
		// console.info('Viewport center:');
		// console.info(viewportCenter);
		map.getView().centerOn(floatCoords, size, viewportCenter);
		if (firstMove && map.getView().getZoom() < 16) {
			map.getView().setZoom(16);
		}
		// map.render();
	}

	fit(geom: number[], opts: any, stopTracking = false, firstMove = false) {
		if (isNaN(geom[0]) || isNaN(geom[1]) || isNaN(geom[2]) || isNaN(geom[3])) {
			return
		}

		if (stopTracking) {
			this.trackBot(null);
		}
		const { viewportPadding } = this.state;
		const size = map.getSize();
		const origZoom = map.getView().getZoom();
		const newRes = map.getView().getResolutionForExtent(geom, size);
		const optsOverride = {
			maxZoom: origZoom
		};

		map.getView().fit(
			geom,
			Object.assign(
				{
					size,
					padding: viewportPadding
				},
				opts,
				optsOverride
			)
		);
		// map.render();
	}

	updateHubsLayer() {
		let hubs = this.podStatus.hubs;

		for (let hubId in hubs) {
			let hub = hubs[hubId];

			// ID
			const hub_id = hub.hub_id
			// Geometry
			const hubLatitude = hub.location?.lat
			const hubLongitude = hub.location?.lon
			// Properties
			const hubHeading = 0

			const hubLayer = this.getLiveLayerFromHubId(hub_id);

			const hubFeature = createHubFeature({
				map: map,
				hubId: Number(hubId),
				lonLat: [hubLatitude, hubLongitude],
				heading: Number(hubHeading),
				courseOverGround: 0
			})

			hubFeature.setId(hub_id);

			const coordinate = equirectangular_to_mercator([hubLongitude, hubLatitude]);

			hubFeature.setGeometry(new OlPoint(coordinate));
			hubFeature.setProperties({
				heading: 0,
				speed: 0,
				hubId: hubId,
			});

			const zoomExtentWidth = 0.001; // Degrees

			hubFeature.set('selected', false);

			hubLayer.getSource().clear();
			hubLayer.getSource().addFeature(hubFeature);

			hubLayer.setZIndex(100);
			hubLayer.changed();
		} // end foreach hub

		//this.timerID = setInterval(() => this.pollPodStatus(), POLLING_INTERVAL_MS);
	}

	updateActiveMissionLayer() {
		const bots = this.podStatus.bots
		let allFeatures = []

		for (let botId in bots) {
			let bot = bots[botId]

			const active_mission_plan = bot.active_mission_plan
			if (active_mission_plan != null) {
				let features = MissionFeatures.createMissionFeatures(map, Number(botId), active_mission_plan, bot.active_goal, this.isBotSelected(Number(botId)))
				allFeatures.push(...features)
			}
		}

		let source = this.activeMissionLayer.getSource()
		source.clear()
		source.addFeatures(allFeatures)
	}

	updateBotsLayer() {
		const { selectedBotsFeatureCollection } = this.state;
		let bots = this.podStatus.bots

		const { trackingTarget } = this.state;

		const botExtents: {[key: number]: number[]} = {};

		// This needs to be synchronized somehow?
		for (let botId in bots) {
			let bot = bots[botId]

			// ID
			const bot_id = bot.bot_id
			// Geometry
			const botLatitude = bot.location?.lat
			const botLongitude = bot.location?.lon
			// Properties
			const botHeading = bot.attitude?.heading
			const botSpeed = bot.speed?.over_ground
			const botTimestamp = new Date(null)
			botTimestamp.setSeconds(bot.time / 1e6)

			const botLayer = this.getLiveLayerFromBotId(bot_id);

			const botFeature = createBotFeature({
				map: map,
				botId: Number(botId),
				lonLat: [botLongitude, botLatitude],
				heading: botHeading,
				courseOverGround: bot.attitude?.course_over_ground
			})

			botFeature.setId(bot_id);

			const coordinate = equirectangular_to_mercator([botLongitude, botLatitude]);

			// Fault Levels

			let faultLevel = 0

			switch(bot.health_state) {
				case "HEALTH__OK":
					faultLevel = 0
					break;
				case "HEALTH__DEGRADED":
					faultLevel = 1
					break;
				default:
					faultLevel = 2
					break;
			}


			// Sounds for disconnect / reconnect
			const disconnectThreshold = 30 * 1e6 // microseconds

			const oldPortalStatusAge = this.oldPodStatus?.bots?.[botId]?.portalStatusAge

			bot.isDisconnected = (bot.portalStatusAge >= disconnectThreshold)

			if (oldPortalStatusAge != null) {
				// Bot disconnect
				if (bot.isDisconnected) {
					if (oldPortalStatusAge < disconnectThreshold) {
						SoundEffects.botDisconnect.play()
					}
				}

				// Bot reconnect
				if (bot.portalStatusAge < disconnectThreshold) {
					if (oldPortalStatusAge >= disconnectThreshold) {
						SoundEffects.botReconnect.play()
					}
				}
			}

			botFeature.setGeometry(new OlPoint(coordinate));
			botFeature.setProperties({
				heading: botHeading,
				speed: botSpeed,
				lastUpdated: bot.time,
				lastUpdatedString: botTimestamp.toISOString(),
				missionState: bot.mission_state,
				healthState: bot.health_state,
				faultLevel: faultLevel,
				isDisconnected: bot.isDisconnected,
				botId: botId,
				isReacquiringGPS: bot.mission_state?.endsWith('REACQUIRE_GPS')
			});

			const zoomExtentWidth = 0.001; // Degrees

			// An array of numbers representing an extent: [minx, miny, maxx, maxy].
			botExtents[bot_id] = [
				botLongitude - zoomExtentWidth / 2,
				botLatitude - zoomExtentWidth / 2,
				botLongitude + zoomExtentWidth / 2,
				botLatitude + zoomExtentWidth / 2
			];

			botFeature.set('selected', false);
			botFeature.set('controlled', false);
			botFeature.set('tracked', false);
			botFeature.set('completed', false);

			// Update feature in selected set
			if (selectedBotsFeatureCollection.getLength() !== 0) {
				for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
					const feature = selectedBotsFeatureCollection.item(i);
					if (feature.getId() === bot_id) {
						botFeature.set('selected', true);
						selectedBotsFeatureCollection.setAt(i, botFeature);
						break;
					}
				}
			}

			if (trackingTarget === bot_id) {
				botFeature.set('tracked', true);
			}

			botFeature.set('remoteControlled', bot.mission_state?.includes('REMOTE_CONTROL') || false)

			botLayer.getSource().clear();
			botLayer.getSource().addFeature(botFeature);

			if (trackingTarget === bot_id) {
				this.centerOn(botFeature.getGeometry().getCoordinates());
			}

			if (botFeature.get('controlled')) {
				botLayer.setZIndex(103);
			} else if (botFeature.get('selected')) {
				botLayer.setZIndex(102);
			} else if (botFeature.get('tracked')) {
				botLayer.setZIndex(101);
			} else {
				botLayer.setZIndex(100);
			}

			botLayer.changed();
		} // end foreach bot
		const { lastBotCount } = this.state;
		const botCount = Object.keys(bots).length

		if (botCount > lastBotCount) {
			this.zoomToAllBots(true);
		} else if (trackingTarget === 'pod') {
			this.zoomToAllBots();
		} else if (trackingTarget === 'all') {
			this.zoomToAll();
		}
		this.setState({
			botExtents,
			selectedBotsFeatureCollection,
			lastBotCount: botCount
		});
		// map.render();
		this.timerID = setInterval(() => this.pollPodStatus(), POLLING_INTERVAL_MS);
	}

	// POLL THE BOTS
	pollPodStatus() {
		clearInterval(this.timerID);
		const us = this;

		this.api.getStatus().then(
			(result) => {
				if (result instanceof Error) {
					this.setState({disconnectionMessage: "No response from JaiaBot API (app.py)"})
					console.error(result)
					this.timerID = setInterval(() => this.pollPodStatus(), 2500)
					return
				}

				if (!("bots" in result)) {
					this.podStatus = null
					this.setState({disconnectionMessage: "No response from JaiaBot API (app.py)"})
					console.error(result)
					this.timerID = setInterval(() => this.pollPodStatus(), 2500)
				}
				else {
					this.oldPodStatus = this.podStatus

					this.podStatus = result

					let messages = result.messages

					if (messages) {
						if (messages.info) {
							info(messages.info)
						}

						if (messages.warning) {
							warning(messages.warning)
						}
					}

					if (messages?.error) {
						this.setState({disconnectionMessage: messages.error})
					}
					else {
						this.setState({disconnectionMessage: null})
					}

					this.updateHubsLayer()
					this.updateBotsLayer()
					this.updateActiveMissionLayer()
					//this.updateHubsLayer()
					if (this.state.mode !== Mode.MISSION_PLANNING) {
						this.updateMissionLayer()
					}
				}
			},
			(err) => {
				this.timerID = setInterval(() => this.pollPodStatus(), 2500);
				this.setState({disconnectionMessage: "No response from JaiaBot API (app.py)"})
			}
		)
	}

	disconnectPod() {
		// This should always work because we're single threaded, right?
		clearInterval(this.timerID);
	}

	zoomToAllBots(firstMove = false) {
		if (this.botsLayerGroup.getLayers().getLength() <= 0) {
			return;
		}
		const extent = OlCreateEmptyExtent();
		let layerCount = 0;
		this.botsLayerGroup.getLayers().forEach((layer: OlVectorLayer<OlVectorSource>) => {
			if (layer.getSource().getFeatures().length <= 0) return;
			OlExtendExtent(extent, layer.getSource().getExtent());
			layerCount += 1;
		});
		if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
	}

	zoomToAll(firstMove = false) {
		const extent = OlCreateEmptyExtent();
		let layerCount = 0;
		const addExtent = (layer: OlVectorLayer<OlVectorSource>) => {
			if (layer.getSource().getFeatures().length <= 0) return;
			OlExtendExtent(extent, layer.getSource().getExtent());
			layerCount += 1;
		};
		this.botsLayerGroup.getLayers().forEach(addExtent);
		if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
	}

	selectBot(bot_id: number) {
		this.selectBots([bot_id]);
	}

	toggleBot(bot_id: number) {
		const botsToSelect = this.isBotSelected(bot_id) ? [] : [bot_id]
		this.selectBots(botsToSelect)
	}

	selectBots(bot_ids: number[]) {
		bot_ids = bot_ids.map(bot_id => { return Number(bot_id) })

		const { selectedBotsFeatureCollection } = this.state;
		const botsLayerCollection = this.botsLayerCollection

		selectedBotsFeatureCollection.clear();
		botsLayerCollection.getArray().forEach((layer) => {
			const feature = layer.getSource().getFeatureById(layer.get('bot_id'));
			if (feature) {
				if (bot_ids.includes(feature.getId() as number)) {
					feature.set('selected', true);
					selectedBotsFeatureCollection.push(feature);
				} else {
					feature.set('selected', false);
				}
			}
		});
		this.setState({ selectedBotsFeatureCollection });

		if (bot_ids.length > 0) {
			this.setState({detailsBoxItem: {type: 'bot', id: bot_ids[0]}})
		}

		this.updateMissionLayer()
		map.render();
	}

	isBotSelected(bot_id: number) {
		const { selectedBotsFeatureCollection } = this.state;
		for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
			if (selectedBotsFeatureCollection.item(i).getId() == bot_id) {
				return true;
			}
		}
		return false;
	}

	zoomToBot(id: number, firstMove = false) {
		const { botExtents } = this.state;
		this.fit(botExtents[id], { duration: 100 }, false, firstMove);
	}

	trackBot(id: number | string) {
		const { trackingTarget } = this.state;
		if (id === trackingTarget) return;
		this.setState({ trackingTarget: id });
		if (id === 'all') {
			this.zoomToAll(true);
			info('Following all');
		} else if (id === 'pod') {
			this.zoomToAllBots(true);
			info('Following pod');
		} else if (id !== null) {
			this.zoomToBot(id as number, true);
			info(`Following bot ${id}`);
		} else if (trackingTarget === 'all') {
			info('Stopped following all');
		} else if (trackingTarget === 'pod') {
			info('Stopped following pod');
		} else {
			info(`Stopped following bot ${trackingTarget}`);
		}
	}

	changeMissions(func: (mission: PodMission) => void, previousMissions: PodMission) {
		// Save a backup of the current mission set
		let oldMissions = deepcopy(this.missions)

		if(previousMissions != null
			|| previousMissions != undefined)
		{
			oldMissions = deepcopy(previousMissions);
		}

		// Do any alterations to the mission set
		func(this.missions)

		// If something was changed
		if (JSON.stringify(oldMissions) != JSON.stringify(this.missions) ) {
			// then place the old mission set into the undoMissions
			this.undoMissionsStack.push(deepcopy(oldMissions))

			// Update the mission layer to reflect changes that were made
			this.updateMissionLayer()
		}
	}

	restoreUndo() {
		if (this.undoMissionsStack.length >= 1) {
			
			this.missions = this.undoMissionsStack.pop()
			this.setState({goalBeingEdited: null})
			this.updateMissionLayer()
		} 
		else
		{
			info("There is no goal or task to undo!");
		}
	}

	sendStop() {
		if (!this.takeControl()) return

		this.api.allStop().then(response => {
			if (response.message) {
				error(response.message)
			}
			else {
				info("Sent STOP")
			}
		})
	}

	returnToHome() {
		if (!this.state.homeLocation) {
			alert('No Home location selected.  Click on the map to select a Home location and try again.')
			return
		}

		let returnToHomeMissions = this.selectedBotIds().map(selectedBotId => Missions.missionWithWaypoints(selectedBotId, [this.state.homeLocation]))

		this.runMissions(returnToHomeMissions)
	}

	static formatLength(line: Geometry) {
		const length = OlGetLength(line, { projection: mercator });
		if (length > 100) {
			return `${Math.round((length / 1000) * 100) / 100} km`;
		}
		return `${Math.round(length * 100) / 100} m`;
	}

	weAreInControl() {
		return (this.podStatus.controllingClientId == this.api.clientId) || this.podStatus.controllingClientId == null
	}

	takeControl() {
		if (this.weAreInControl()) return true;
		return confirm('WARNING:  Another client is currently controlling the team.  Click OK to take control of the team.')
	}

	// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
	// eslint-disable-next-line class-methods-use-this

	render() {
		const {
			trackingTarget,
			measureActive,
			surveyPolygonActive,
			mapLayerActive,
			engineeringPanelActive
		} = this.state;
		
		// Are we currently in control of the bots?
		const containerClasses = this.weAreInControl() ? 'controlling' : 'noncontrolling'

		let self = this

		let bots = this.podStatus?.bots
		let hubs = this.podStatus?.hubs

		let goalSettingsPanel: ReactElement = null
		if (this.state.goalBeingEdited != null) {
			goalSettingsPanel = 
				<GoalSettingsPanel 
					botId={this.state.goalBeingEditedBotId}
					goalIndex={this.state.goalBeingEditedGoalIndex}
					goal={this.state.goalBeingEdited} 
					onChange={() => { this.updateMissionLayer() }} 
					onClose={() => 
						{ 
							this.setState({goalBeingEdited: null})
							this.changeMissions(() => {}, previous_mission_history);
						}
					} 
				/>
		}

		// Add mission generation form to UI if the survey polygon has changed.
		let missionSettingsPanel: ReactElement = null
		if (this.state.mode === Mode.MISSION_PLANNING) {
			missionSettingsPanel = <MissionSettingsPanel
				mission_params={this.state.missionParams}
				bot_list={this.podStatus?.bots}
				goal={this.state.missionBaseGoal}
				style={this.state.missionBaseStyle}
				onClose={() => {
					this.clearMissionPlanningState()
				}}
				onMissionChangeEditMode={() => {
					this.changeMissionMode()
				}}
				onTaskTypeChange={() => {
					this.setState({
						missionPlans: null
					})
					this.missions = {};
					this.updateMissionLayer()
				}}
				onMissionApply={() => {
					if (this.state.missionParams.mission_type === 'lines') {
						this.updateMissionLayer();
						this.loadMissions(this.state.missionPlans)
					} else {
						// Polygon
						this.genMission()
					}
				}}
				onMissionChangeBotList={() => {
					this.changeMissionBotList()
				}} />
		}

		// Details box
		let detailsBoxItem = this.state.detailsBoxItem
		var detailsBox = null

		function closeDetails() {
			self.setState({detailsBoxItem: null})
		}

		switch (detailsBoxItem?.type) {
			case 'hub':
				detailsBox = HubDetailsComponent(hubs?.[detailsBoxItem.id], 
												this.api, 
												closeDetails, 
												this.state.detailsExpanded,
												this.takeControl.bind(this));
				
				break;
			case 'bot':
				//**********************
				// TO DO  
				// the following line assumes fleets to only have hub0 in use
				//**********************
				detailsBox = BotDetailsComponent(bots?.[this.selectedBotId()], 
												hubs?.[0], 
												this.api, 
												this.missions, 
												closeDetails,
												this.takeControl.bind(this),
												this.state.detailsExpanded);
				break;
			default:
				detailsBox = null;
				break;
		}

		return (
			<div id="axui_container" className={containerClasses}>

				<EngineeringPanel api={this.api} bots={bots} getSelectedBotId={this.selectedBotId.bind(this)} control={this.takeControl.bind(this)} />

				<div id={this.mapDivId} className="map-control" />

				<div id="mapLayers" />

				<div id="layerinfo">&nbsp;</div>

				<div id="viewControls">

					{mapLayerActive ? (
						<Button className="button-jcc active"
							onClick={() => {
								this.setState({mapLayerActive: false}); 
								($('#mapLayers') as any).toggle('blind', { direction: 'right' });
								$('#mapLayersButton').toggleClass('active');
							}}
						>
							<FontAwesomeIcon icon={faLayerGroup as any} title="Map Layers" />
						</Button>

					) : (
						<Button className="button-jcc"
							onClick={() => {
								this.setState({mapLayerActive: true}); 
								($('#mapLayers') as any).toggle('blind', { direction: 'right' });
								$('#mapLayersButton').toggleClass('active');
							}}
						>
							<FontAwesomeIcon icon={faLayerGroup as any} title="Map Layers" />
						</Button>
					)}

					{measureActive ? (
						<div>
							<div id="measureResult" />
							<Button
								className="button-jcc active"
								onClick={() => {
									// this.measureInteraction.finishDrawing();
									this.changeInteraction();
									this.setState({ measureActive: false });
								}}
							>
								<FontAwesomeIcon icon={faRuler as any} title="Measurement Result" />
							</Button>
						</div>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.setState({ measureActive: true });
								this.changeInteraction(this.measureInteraction, 'crosshair');
								info('Touch map to set first measure point');
							}}
						>
							<FontAwesomeIcon icon={faRuler as any} title="Measure Distance"/>
						</Button>
					)}
					{trackingTarget === 'all' ? (
						<Button onClick={this.trackBot.bind(this, '')} className="button-jcc active">
							<FontAwesomeIcon icon={faMapMarkedAlt as any} title="Unfollow" />
						</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.zoomToAll(true);
								this.trackBot('all');
							}}
						>
							<FontAwesomeIcon icon={faMapMarkedAlt as any} title="Follow All" />
						</Button>
					)}
					{trackingTarget === 'pod' ? (
						<Button onClick={this.trackBot.bind(this, '')} className="button-jcc active">
							<FontAwesomeIcon icon={faMapMarkerAlt as any} title="Unfollow" />
						</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.zoomToAllBots(true);
								this.trackBot('pod');
							}}
						>
							<FontAwesomeIcon icon={faMapMarkerAlt as any} title="Follow Pod" />
						</Button>
					)}

					{surveyPolygonActive ? (
							<Button
								className="button-jcc active"
								onClick={() => {
									this.changeInteraction();
									this.setState({
										surveyPolygonActive: false,
										mode: '',
										surveyPolygonChanged: false,
										missionPlanningGrid: null,
										missionPlanningLines: null
									});
									this.updateMissionLayer();
								}}
							>
								<FontAwesomeIcon icon={faEdit as any} title="Stop Editing Optimized Mission Survey" />
							</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.setState({ surveyPolygonActive: true, mode: Mode.MISSION_PLANNING });
								if (this.state.missionParams.mission_type === 'polygon-grid')
									this.changeInteraction(this.surveyPolygonInteraction, 'crosshair');
								if (this.state.missionParams.mission_type === 'editing')
									this.changeInteraction(this.selectInteraction(), 'grab');
								if (this.state.missionParams.mission_type === 'lines')
									this.changeInteraction(this.surveyLinesInteraction, 'crosshair');
								if (this.state.missionParams.mission_type === 'exclusions')
									this.changeInteraction(this.surveyExclusionsInteraction, 'crosshair');

								info('Touch map to set first polygon point');
							}}
						>
							<FontAwesomeIcon icon={faEdit as any} title="Edit Optimized Mission Survey" />
						</Button>
					)}
					
					{engineeringPanelActive ? (
						<Button className="button-jcc active" onClick={() => {
								this.setState({engineeringPanelActive: false}); 
								this.toggleEngineeringPanel();
							}} 
						>
							<FontAwesomeIcon icon={faWrench as any} title="Engineering Panel" />
						</Button>

					) : (
						<Button className="button-jcc" onClick={() => {
							this.setState({engineeringPanelActive: true}); 
							this.toggleEngineeringPanel();
						}} 
						>
							<FontAwesomeIcon icon={faWrench as any} title="Engineering Panel" />
						</Button>
					)}

					<img className="jaia-logo button" src="/favicon.png" onClick={() => { 
						alert("Jaia Robotics\nAddress: 22 Burnside St\nBristol\nRI 02809\nPhone: P: +1 401 214 9232\n"
							+ "Comnpany Website: https://www.jaia.tech/\nDocumentation: http://52.36.157.57/index.html\n") 
						}}>	
					</img>

				</div>

				<div id="botsDrawer">
					<BotListPanel podStatus={this.podStatus} 
						selectedBotId={this.selectedBotId()} 
						trackedBotId={this.state.trackingTarget}
						didClickBot={this.didClickBot.bind(this)}
						didClickHub={this.didClickHub.bind(this)} />
					<div id="jaiabot3d" style={{"zIndex":"10", "width":"50px", "height":"50px", "display":"none"}}></div>
				</div>

				{detailsBox}

				{goalSettingsPanel}

				{missionSettingsPanel}

				{this.takeControlPanel()}

				{this.commandDrawer()}

				{this.state.loadMissionPanel}

				{this.state.saveMissionPanel}

				{this.disconnectionPanel()}
				
			</div>
		);
	}

	didClickBot(bot_id: number) {
		if (this.isBotSelected(bot_id)) {
			this.selectBots([])
		}
		else {
			this.selectBot(bot_id)
		}
	}

	didClickHub(hub_id: number) {
		const item = {'type': 'hub', id: hub_id}

		if (areEqual(this.state.detailsBoxItem, item)) {
			this.setState({detailsBoxItem: null})
		}
		else {
			this.setState({detailsBoxItem: item})
		}
	}

	takeControlPanel() {
		if (this.weAreInControl()) {
			return null
		}

		const takeControl = (evt: MouseEvent) => {
			this.api.takeControl()
		}

		return (
			<div className="take-control-panel">Another client is in control of this team
				<Button className="button-jcc" id="takeControlButton" onClick={takeControl}>Take Control</Button>
			</div>
		)
	}

	locationFromCoordinate(coordinate: number[]) {
		let latlon = this.coordinate_to_location_transform(coordinate)
		return {lat: latlon[1], lon: latlon[0]}
	}

	addWaypointAtCoordinate(coordinate: number[]) {
		this.addWaypointAt(this.locationFromCoordinate(coordinate))
	}

	addWaypointAt(location: GeographicCoordinate) {
		let botId = this.selectedBotIds().at(-1)
		let millisecondsSinceEpoch = new Date().getTime();

		if (botId == null) {
			return
		}

		this.changeMissions((missions) => {
			
			if (!(botId in missions)) {
				missions[botId] = {
					bot_id: botId,
					time: millisecondsSinceEpoch,
					type: CommandType.MISSION_PLAN,
					plan: {
						start: MissionStart.START_IMMEDIATELY,
						movement: MovementType.TRANSIT,
						goal: [],
						recovery: {recover_at_final_goal: true}
					}
				}
			}
			if(missions[botId].plan.goal.length < MAX_GOALS)
			{
				missions[botId].plan.goal.push({location: location})	
			}
			else
			{
				warning("Adding this goal exceeds the limit of "+ MAX_GOALS +"!");
			}
		}, null)

	}

	setGrid2Style(self: CommandControl, feature: OlFeature<Geometry>, taskType: TaskType) {
		return Styles.goalIcon(taskType, false, false)
	}

	setGridStyle(self: CommandControl, taskType: TaskType) {
		return Styles.goalIcon(taskType, false, false)
	}

	surveyStyle(self: CommandControl, feature: OlFeature<Geometry>, taskType: TaskType) {
			// console.log('WHAT IS GOING ON!!!!');
			// console.log(feature);
			// console.log(self.state);
			// console.log(self.homeLocation);

		let iStyle = this.setGridStyle(self, taskType)

			let lineStyle = new OlStyle({
				fill: new OlFillStyle({
					color: 'rgba(255, 255, 255, 0.2)'
				}),
				stroke: new OlStrokeStyle({
					color: 'rgb(5,29,97)',
					lineDash: [10, 10],
					width: 2
				}),
				image: iStyle
			});

			let iconStyle = new OlStyle({
				image: new OlIcon({
					src: missionOrientationIcon,
					scale: [0.5, 0.5]
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
			// console.log('surveyLineStyle');
			// console.log(feature);
			let rotationAngle = 0;
			let rhumbDist = 0;
			let rhumbHomeDist = 0;
			let stringCoords = (feature.getGeometry() as LineString).getCoordinates();
			// console.log('stringCoords');
			// console.log(stringCoords);
			let coords = stringCoords.slice(0, 2);

			// console.log('iconStyle');
			// console.log(iconStyle);
			iconStyle.setGeometry(new OlPoint(stringCoords[0]));
			iconStyle
				.getImage()
				.setRotation(
					Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1])
				);
			let rotAngRadians = Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]);

			rotationAngle = Number((Math.trunc(turf.radiansToDegrees(rotAngRadians)*100)/100).toFixed(2));
			if (rotationAngle < 0) {
				rotationAngle = rotationAngle + 360;
			}
			// console.log('coords');
			// console.log(coords);
			// console.log(coords.length);

			const { homeLocation } = self.state;
			if (stringCoords[0].length >= 2) {
				let previousIndex = stringCoords.length - 2;
				let nextIndex = stringCoords.length - 1;
				// console.log('INDEXES');
				// console.log(previousIndex);
				// console.log(nextIndex);
				rhumbDist = turf.rhumbDistance(turf.toWgs84(turf.point(stringCoords[previousIndex])), turf.toWgs84(turf.point(stringCoords[nextIndex])), {units: 'kilometers'});
				let rhumbDistString = Number(rhumbDist.toFixed(2)).toString();
				if (homeLocation !== null) {
					rhumbHomeDist = turf.rhumbDistance(turf.toWgs84(turf.point(stringCoords[nextIndex])), turf.point([homeLocation.lon, homeLocation.lat]), {units: 'kilometers'});
					let rhumbHomeDistString = Number(rhumbHomeDist.toFixed(2)).toString();
				}
			}

			return [lineStyle, iconStyle];
		};

	setSurveyStyle(self: CommandControl, feature: OlFeature<Geometry>, taskType: TaskType) {
		let featureStyles = this.surveyStyle(self, feature, taskType);
		feature.setStyle(featureStyles);
		return feature
	}

	setGridFeatureStyle(self: CommandControl, feature: OlFeature<Geometry>, taskType: TaskType) {
		if (feature) {
			let gridStyle = new OlStyle({
				image: this.setGrid2Style(self, feature, taskType)
			})
			
			feature.setStyle(gridStyle);
		}
		return feature
	}

	findRallySeparation(bot_list: number[], feature: GeographicCoordinate, rotationAngle: number, rallySpacing: number) {
		// Bot rally point separation scheme
		let rallyPoints: any = {};
		let center = [feature.lon, feature.lat];
		let radius = rallySpacing/1000;
		if (bot_list.length >= 3) {
			// We can use a circle to separate the bots
			let options = {steps: bot_list.length};
			let circle = turf.circle(center, radius, options);
			let circleRallyPointsBasic = turf.coordAll(turf.cleanCoords(turf.multiPoint(circle.geometry.coordinates[0])));
			circleRallyPointsBasic.forEach(p => {
				rallyPoints[Number(bot_list.pop())] = p
			})
		} else {
			// Alternative to using a circle for bot separation
			let rhumbDestinationPoints: number[][][] = [];
			let nextRadius = 0;
			bot_list.forEach(bot => {
				rhumbDestinationPoints.push(turf.coordAll(turf.rhumbDestination(turf.point(center), nextRadius, rotationAngle-90)));
				nextRadius = nextRadius + radius;
			})
			rhumbDestinationPoints.forEach(p => {
				rallyPoints[Number(bot_list.pop())] = p[0]
			})
		}
		return rallyPoints
	}

	updateMissionLayer() {
		// Update the mission layer
		let features = []

		let missions = this.missions || {}

		let selectedColor = '#34d2eb'
		let unselectedColor = 'white'
		let surveyPolygonColor = '#051d61'
		let surveyExclusionsColor = '#c40a0a'

		let rallyPointRedStyle = new OlStyle({
			image: new OlIcon({
				src: rallyPointRedIcon,
				scale: [0.5, 0.5]
			})
		})

		let rallyPointGreenStyle = new OlStyle({
			image: new OlIcon({
				src: rallyPointGreenIcon,
				scale: [0.5, 0.5]
			})
		})

		// let missionOrientationPointStyle = new OlStyle({
		// 	image: new OlIcon({
		// 		src: missionOrientationIcon,
		// 		scale: [0.5, 0.5]
		// 	})
		// })

		// let gridStyle = new OlStyle({
		// 	image: this.setGridStyle(this.state.missionBaseGoal.task.type)
		// 	// image: new OlIcon({ src: waypointIcon })
		// })

		let selectedLineStyle = new OlStyle({
			fill: new OlFillStyle({color: selectedColor}),
			stroke: new OlStrokeStyle({color: selectedColor, width: 2.5}),
		})

		let defaultLineStyle = new OlStyle({
			fill: new OlFillStyle({color: unselectedColor}),
			stroke: new OlStrokeStyle({color: unselectedColor, width: 2.0}),
		})

		let surveyPolygonLineStyle = new OlStyle({
			fill: new OlFillStyle({color: surveyPolygonColor}),
			stroke: new OlStrokeStyle({color: surveyPolygonColor, width: 3.0}),
		})

		let surveyPlanLineStyle = new OlStyle({
			fill: new OlFillStyle({color: surveyPolygonColor}),
			stroke: new OlStrokeStyle({color: surveyPolygonColor, width: 1.0}),
		})

		for (let botId in missions) {
			// Different style for the waypoint marker, depending on if the associated bot is selected or not
			let lineStyle

			let selected = this.isBotSelected(Number(botId))

			let active_goal_index = this.podStatus?.bots?.[botId]?.active_goal

			// Add our goals
			const plan = missions[botId].plan
			if (plan != null) {
				const missionFeatures = MissionFeatures.createMissionFeatures(map, Number(botId), plan, active_goal_index, selected)
				features.push(...missionFeatures)
			}
		}

		// Add Home, if available
		if (this.state.rallyPointRedLocation) {
			let pt = equirectangular_to_mercator([this.state.rallyPointRedLocation.lon, this.state.rallyPointRedLocation.lat])
			let rallyPointRedFeature = new OlFeature({ geometry: new OlPoint(pt) })
			rallyPointRedFeature.setStyle(rallyPointRedStyle)
			features.push(rallyPointRedFeature)
		}

		if (this.state.rallyPointGreenLocation) {
			let pt = equirectangular_to_mercator([this.state.rallyPointGreenLocation.lon, this.state.rallyPointGreenLocation.lat])
			let rallyPointGreenFeature = new OlFeature({ geometry: new OlPoint(pt) })
			rallyPointGreenFeature.setStyle(rallyPointGreenStyle)
			features.push(rallyPointGreenFeature)
		}

		if (this.state.surveyPolygonCoords) {
			let pts = this.state.surveyPolygonCoords.getCoordinates()
			let transformed_survey_pts = pts.map((pt) => {
				return equirectangular_to_mercator([pt[0], pt[1]])
			})
			let surveyPolygonFeature = new OlFeature(
				{
					geometry: new OlLineString(transformed_survey_pts),
					name: "Survey Bounds"
				}
			)
			surveyPolygonFeature.setStyle(surveyPolygonLineStyle);
			features.push(surveyPolygonFeature);
		}

		if (this.state.missionPlanningLines) {
			let mpl = this.state.missionPlanningLines;
			let mplKeys = Object.keys(mpl);
			// console.log('this.state.missionPlanningLines');
			// console.log(mplKeys);
			// console.log(mpl);
			mplKeys.forEach(key => {
				let mpLineFeatures = new OlFeature(
					{
						geometry: new OlMultiLineString(mpl[key])
					}
				)
				mpLineFeatures.setProperties({'botId': key});
				mpLineFeatures.setStyle(surveyPlanLineStyle);
				features.push(mpLineFeatures);
			})
		}

		if (this.state.missionPlanningGrid) {
			let missionPlans: any = {};
			let millisecondsSinceEpoch = new Date().getTime();
			let bot_list = Object.keys(this.podStatus.bots);

			// Bot rally point separation scheme
			let rallyStartPoints = this.findRallySeparation(deepcopy(bot_list), this.state.rallyPointGreenLocation, this.state.missionParams.orientation, this.state.missionParams.rally_spacing);
			// console.log('rallyStartPoints');
			// console.log(rallyStartPoints);
			let rallyFinishPoints = this.findRallySeparation(deepcopy(bot_list), this.state.rallyPointRedLocation, this.state.missionParams.orientation, this.state.missionParams.rally_spacing);
			// console.log('rallyFinishPoints');
			// console.log(rallyFinishPoints);

			let mpg = this.state.missionPlanningGrid;
			let mpgKeys = Object.keys(mpg);
			mpgKeys.forEach(key => {
				let mpGridFeature = new OlFeature(
					{
						geometry: new OlMultiPoint(mpg[key])
					}
				)
				mpGridFeature.setProperties({'botId': key});
				// let activeGridStyle = this.setGridStyle(this, mpGridFeature, this.state.missionBaseGoal.task.type)
				let mpGridFeatureStyled = this.setGridFeatureStyle(this, mpGridFeature, this.state.missionBaseGoal.task.type);
				features.push(mpGridFeatureStyled);

				// TODO: Update the mission plan for the bots at the same time??
				// Create the goals from the missionPlanningGrid
				let bot_goals = [];

				// Rally Point Goals
				let bot_goal: Goal = {
					"location": {
						"lat": rallyStartPoints[key][1],
						"lon": rallyStartPoints[key][0]
					},
					"task": {"type": TaskType.STATION_KEEP}
				}
				bot_goals.push(bot_goal)

				// Mission Goals
				mpg[key].forEach((goal: any) => {
					let goalWgs84 = turf.coordAll(turf.toWgs84(turf.point(goal)))[0]
					bot_goal = {
						"location": {
							"lat": goalWgs84[1],
							"lon": goalWgs84[0]
						},
						"task": this.state.missionBaseGoal.task
					}
					bot_goals.push(bot_goal);
				})

				// Home Goals
				bot_goal = {
					"location": {
						"lat": rallyFinishPoints[key][1],
						"lon": rallyFinishPoints[key][0]
					},
					"task": {"type": TaskType.STATION_KEEP}
				}
				bot_goals.push(bot_goal)

				let mission_dict = {
					bot_id: Number(key),
					time: millisecondsSinceEpoch,
					type: "MISSION_PLAN",
					plan: {
						start: "START_IMMEDIATELY",
						movement: "TRANSIT",
						goal: bot_goals,
						recovery: {
							recover_at_final_goal: true
						}
					}
				}
				missionPlans[key] = mission_dict;
			})

			this.setState({
				missionPlans: missionPlans
			})
		}

		if (this.state.missionPlanningFeature) {
			// Place all the mission planning features in this for the missionLayer
			let missionPlanningFeaturesList = [];

			if (this.state.missionParams.mission_type === 'lines' && this.state.mode === Mode.MISSION_PLANNING) {
				// Add the mission planning feature
				let mpFeature = this.state.missionPlanningFeature;
				let mpStyledFeature = this.setSurveyStyle(this, mpFeature, this.state.missionBaseGoal.task.type);
				missionPlanningFeaturesList.push(mpStyledFeature)

				// Add all the features in the list to the map layer
				let missionPlanningSource = new OlVectorSource({
					features: missionPlanningFeaturesList
				})
				this.missionPlanningLayer.setSource(missionPlanningSource);
				this.missionPlanningLayer.setZIndex(2000);
			}
		}

		let vectorSource = new OlVectorSource({
			features: features as any
		})

		this.missionLayer.setSource(vectorSource)
		this.missionLayer.setZIndex(1000)
	}

	// Runs a mission
	_runMission(bot_mission: Command) {
		// Set the speed values
		bot_mission.plan.speeds = GlobalSettings.missionPlanSpeeds

		console.debug('Running Mission:')
		console.debug(bot_mission)

		this.api.postCommand(bot_mission).then(response => {
			if (response.message) {
				error(response.message)
			}
		})
	}

	// Runs a set of missions, and updates the GUI
	runMissions(missions: PodMission) {
		if (!this.takeControl()) return

		let botIds: number[] = [];
		let botIdsInIdleState: number[] = [];
		for(let mission in missions)
		{
			let botState = this.podStatus.bots[missions[mission].bot_id].mission_state;

			if(botState == "PRE_DEPLOYMENT__IDLE"
				|| botState == "POST_DEPLOYMENT__IDLE")
			{
				botIdsInIdleState.push(missions[mission].bot_id);
			}
			else
			{
				botIds.push(missions[mission].bot_id);
			}
		}

		botIds.sort()
		botIdsInIdleState.sort();

		if(botIdsInIdleState.length != 0)
		{
			warning("Please activate bots: " + botIdsInIdleState);
		} 
		else
		{
			if (confirm("Click the OK button to run this mission for bots: " + botIds)) {
				for (let bot_id in missions) {
					let mission = missions[bot_id]
					this.missions[mission.bot_id] = deepcopy(mission)
					this._runMission(mission)
				}
				success("Submitted missions")
				this.updateMissionLayer()
			}
		}
	}

	// Loads the set of missions, and updates the GUI
	loadMissions(missions: PodMission) {
		this.missions = deepcopy(missions)

		// selectedBotId is a placeholder for the currently selected botId
		if (SELECTED_BOT_ID in this.missions) {
			let selectedBotId = this.selectedBotId() ?? 0
			
			this.missions[selectedBotId] = this.missions[SELECTED_BOT_ID]
			this.missions[selectedBotId].bot_id = selectedBotId
			delete this.missions[SELECTED_BOT_ID]
		}

		console.log(this.missions)

		this.updateMissionLayer()
	}

	// Currently selected botId
	selectedBotId() {
		return this.selectedBotIds().at(-1)
	}

	// Runs the currently loaded mission
	runLoadedMissions(botIds: number[] = []) {
		if (!this.takeControl()) return

		if (botIds.length == 0) {
			botIds = Object.keys(this.missions) as any
		}

		let botIdsInIdleState = [];
		for(let botId in botIds)
		{
			let botState = this.podStatus.bots[botIds[botId]].mission_state;

			if(botState == "PRE_DEPLOYMENT__IDLE"
				|| botState == "POST_DEPLOYMENT__IDLE")
			{
				botIdsInIdleState.push(botIds[botId]);
			}
		}

		botIds.sort()
		botIdsInIdleState.sort();

		if(botIdsInIdleState.length != 0)
		{
			warning("Please activate bots: " + botIdsInIdleState);
		} 
		else
		{
			if (confirm("Click the OK button to run the mission for bots: " + botIds.join(', '))) {
				for (let bot_id of botIds) {
					let mission = this.missions[bot_id]
					if (mission) {
						this._runMission(mission)
					}
					else {
						error('No mission set for bot ' + bot_id)
					}
				}
				info('Submitted missions for ' + botIds.length + ' bots')
			}	
		}
	}

	// Clears the currently active mission
	// trash button, delete button, clear button
	deleteClicked() {
		let selectedBotId = this.selectedBotId()
		let botString = (selectedBotId == null) ? "ALL Bots" : "Bot " + selectedBotId

		if (confirm('Delete mission for ' + botString + '?')) {
			if (selectedBotId != null) {
				this.changeMissions(() => {
					delete this.missions[selectedBotId]
				}, undefined)
			}
			else {
				this.changeMissions(() => {
					this.missions = {}
				}, undefined)
			}

			this.setState({
				surveyPolygonFeature: null,
				surveyPolygonGeoCoords: null,
				surveyPolygonCoords: null,
				surveyPolygonChanged: false,
				goalBeingEdited: null 			// Because goals may have been deleted, we should set the goalBeingEdited to null
			})

			this.updateMissionLayer()
		}
	}

	selectedBotIds() {
		const { selectedBotsFeatureCollection } = this.state
		let botIds: number[] = []

		// Update feature in selected set
		for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
			const feature = selectedBotsFeatureCollection.item(i)
			const botId = feature.getId() as number
			if (botId != null) {
				botIds.push(botId)
			}
		}

		return botIds
	}

	// SelectInteraction

	selectInteraction() {
		return new SelectInteraction()
	}

	// TranslateInteraction

	translateInteraction() {
		return new TranslateInteraction({
			features: this.state.selectedFeatures
		})
	}

	// PointerInteraction

	pointerInteraction() {
		return new PointerInteraction({
			handleEvent: this.handleEvent.bind(this),
			stopDown: this.stopDown.bind(this)
		})
	}

	handleEvent(evt: any) {
		switch(evt.type) {
			case 'click':
				return this.clickEvent(evt as MapBrowserEvent<UIEvent>)
				// break;
			case 'dragging':
				return
		}
		return true
	}

	clickEvent(evt: MapBrowserEvent<UIEvent>) {
		const map = evt.map;

		if (this.state.mode == Mode.SET_HOME) {
			this.placeHomeAtCoordinate(evt.coordinate)
			return false // Not a drag event
		}

		if (this.state.mode == Mode.SET_RALLY_POINT_GREEN) {
			this.placeRallyPointGreenAtCoordinate(evt.coordinate)
			return false // Not a drag event
		}

		if (this.state.mode == Mode.SET_RALLY_POINT_RED) {
			this.placeRallyPointRedAtCoordinate(evt.coordinate)
			return false // Not a drag event
		}

		const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature: OlFeature<Geometry>) {
			return feature
		});

		if (feature) {
			// Clicked on a goal / waypoint
			let goal = feature.get('goal')
			let botId = feature.get('botId')
			let goalIndex = feature.get('goalIndex')

			if (goal != null) {
				previous_mission_history = deepcopy(this.missions);
				this.setState({
					goalBeingEdited: goal, 
					goalBeingEditedBotId: botId, 
					goalBeingEditedGoalIndex: goalIndex
				})
				return false
			}

			// Clicked on a bot
			if (this.isBotSelected(Number(feature.getId()))) {
				this.selectBots([])
			}
			else {
				this.selectBots([Number(feature.getId())])
			}

			// Clicked on mission planning point
			if (goal == null) {
				if (this.state.mode == Mode.MISSION_PLANNING) {
					this.state.selectedFeatures = new OlCollection([ feature ])
				}
			}
		}
		else {
			this.addWaypointAtCoordinate(evt.coordinate)
		}

		return true
	}

	placeHomeAtCoordinate(coordinate: number[]) {
		let lonlat = mercator_to_equirectangular(coordinate)
		let location = {lon: lonlat[0], lat: lonlat[1]}

		this.setState({
			homeLocation: location,
			mode: ''
		})

		this.toggleMode(Mode.SET_HOME)
		this.updateMissionLayer()
	}

	placeRallyPointGreenAtCoordinate(coordinate: number[]) {
		let lonlat = mercator_to_equirectangular(coordinate)
		let location = {lon: lonlat[0], lat: lonlat[1]}
		this.setState({
			rallyPointGreenLocation: location,
			mode: ''
		})

		this.toggleMode(Mode.SET_RALLY_POINT_GREEN)
		this.updateMissionLayer()
	}

	placeRallyPointRedAtCoordinate(coordinate: number[]) {
		let lonlat = mercator_to_equirectangular(coordinate)
		let location = {lon: lonlat[0], lat: lonlat[1]}
		this.setState({
			rallyPointRedLocation: location,
			mode: ''
		})

		this.toggleMode(Mode.SET_RALLY_POINT_RED)
		this.updateMissionLayer()
	}

	stopDown(arg: boolean) {
		return false
	}

	generateMissions() {
		if (!this.takeControl()) return;

		let bot_list = [];
		for (const bot in this.podStatus.bots) {
			bot_list.push(this.podStatus.bots[bot]['bot_id'])
		}

		this.api.postMissionFilesCreate({
			"bot_list": bot_list,
			"sample_spacing": this.state.missionParams.spacing,
			"mission_type": this.state.missionBaseGoal.task,
			"orientation": this.state.missionParams.orientation,
			"home_lon": this.state.homeLocation?.['lon'],
			"home_lat": this.state.homeLocation?.['lat'],
			"survey_polygon": this.state.surveyPolygonGeoCoords,
			//"inside_points_all": this.state.missionPlanningGrid.getCoordinates()
		}).then(data => {
			this.loadMissions(data);
		});

	}

	// Command Drawer
	commandDrawer() {
		let element = (
			<div id="commandsDrawer">
				<Button id="system-check-all-bots" className="button-jcc" onClick={this.activateAllClicked.bind(this)}>
					<Icon path={mdiCheckboxMarkedCirclePlusOutline} title="System Check All Bots"/>
				</Button>
				<Button className="button-jcc" id="setRallyPointGreen" onClick={this.setRallyPointGreenClicked.bind(this)}>
					<img src={rallyPointGreenIcon} title="Set Start Rally" />
				</Button>
				<Button className="button-jcc" id="goToRallyGreen" onClick={this.goToRallyGreen.bind(this)}>
					<img src={goToRallyGreen} title="Go To Start Rally" />
				</Button>
				<Button className="button-jcc" id="setRallyPointRed" onClick={this.setRallyPointRedClicked.bind(this)}>
					<img src={rallyPointRedIcon} title="Set Finish Rally" />
				</Button>
				<Button className="button-jcc" id="goToRallyRed" onClick={this.goToRallyRed.bind(this)}>
					<img src={goToRallyRed} title="Go To Finish Rally" />
				</Button>
				<Button className="button-jcc" style={{"backgroundColor":"#cc0505"}} onClick={this.sendStop.bind(this)}>
				    <Icon path={mdiStop} title="Stop All Missions" />
				</Button>
				{/*<Button id= "missionPause" className="button-jcc inactive" disabled>
					<Icon path={mdiPause} title="Pause All Missions"/>
				</Button>*/}
				<Button id= "missionStartStop" className="button-jcc stopMission" onClick={this.playClicked.bind(this)}>
					<Icon path={mdiPlay} title="Run Mission"/>
				</Button>
				<Button id= "all-next-task" className="button-jcc" onClick={this.nextTaskAllClicked.bind(this)}>
					<Icon path={mdiSkipNext} title="All Next Task"/>
				</Button>
				<Button id= "missionRecover" className="button-jcc" onClick={this.recoverAllClicked.bind(this)}>
					<Icon path={mdiDownload} title="Recover All"/>
				</Button>
				<Button className="button-jcc" onClick={this.loadMissionButtonClicked.bind(this)}>
					<Icon path={mdiFolderOpen} title="Load Mission"/>
				</Button>
				<Button className="button-jcc" onClick={this.saveMissionButtonClicked.bind(this)}>
					<Icon path={mdiContentSave} title="Save Mission"/>
				</Button>
				<Button className="button-jcc" onClick={this.deleteClicked.bind(this)}>
					<Icon path={mdiDelete} title="Clear Mission"/>
				</Button>
				{ this.undoButton() }					
				<Button className="button-jcc" onClick={this.sendFlag.bind(this)}>
					<Icon path={mdiFlagVariantPlus} title="Flag"/>
				</Button>
			</div>

		)

		return element
	}

	loadMissionButtonClicked() {
		let panel = <LoadMissionPanel missionLibrary={MissionLibraryLocalStorage.shared()} selectedMission={(mission) => {
			this.loadMissions(mission)
			this.setState({loadMissionPanel: null})
		}} onCancel={() => {
			this.setState({loadMissionPanel: null})
		}}></LoadMissionPanel>

		this.setState({loadMissionPanel: panel})
	}

	saveMissionButtonClicked() {
		let panel = <SaveMissionPanel missionLibrary={MissionLibraryLocalStorage.shared()} missions={this.missions} onDone={() => {
			this.setState({saveMissionPanel: null})
		}}></SaveMissionPanel>

		this.setState({saveMissionPanel: panel})
	}

	undoButton() {
		return (<Button className={"globalCommand" + " button-jcc"} onClick={this.restoreUndo.bind(this)}><Icon path={mdiArrowULeftTop} title="Undo"/></Button>)
	}

	setHomeClicked(evt: UIEvent) {
		this.toggleMode(Mode.SET_HOME)
	}

	setRallyPointRedClicked(evt: Event) {
		this.toggleMode(Mode.SET_RALLY_POINT_RED)
	}

	setRallyPointGreenClicked(evt: Event) {
		this.toggleMode(Mode.SET_RALLY_POINT_GREEN)
	}

	goHomeClicked(evt: UIEvent) {
		this.returnToHome()
	}

	goToRallyGreen(evt: UIEvent) {
		if (!this.state.rallyPointGreenLocation) {
			alert('No green rally point selected.  Click on the map to select a green rally location and try again.')
			return
		}

		let goToRallyGreenMission = this.selectedBotIds().map(selectedBotId => Missions.missionWithWaypoints(selectedBotId, [this.state.rallyPointGreenLocation]))
		if (goToRallyGreenMission.length == 0)
		{
			for(let bot in this.podStatus.bots)
			{
				goToRallyGreenMission.push(Missions.missionWithWaypoints(Number(bot), [this.state.rallyPointGreenLocation]))
			}
		}

		this.runMissions(goToRallyGreenMission)
	}

	goToRallyRed(evt: UIEvent) {
		if (!this.state.rallyPointRedLocation) {
			alert('No red rally point selected.  Click on the map to select a red rally location and try again.')
			return
		}

		let goToRallyRedMission = this.selectedBotIds().map(selectedBotId => Missions.missionWithWaypoints(selectedBotId, [this.state.rallyPointRedLocation]))
		if (goToRallyRedMission.length == 0)
		{
			for(let bot in this.podStatus.bots)
			{
				goToRallyRedMission.push(Missions.missionWithWaypoints(Number(bot), [this.state.rallyPointRedLocation]))
			}
		}

		this.runMissions(goToRallyRedMission)
	}

	playClicked(evt: UIEvent) {
		this.runLoadedMissions(this.selectedBotIds())
	}
	
	activateAllClicked(evt: UIEvent) {
		if (!this.takeControl()) return;

		this.api.allActivate().then(response => {
			if (response.message) {
				error(response.message)
			}
			else {
				info("Sent Activate All")
			}
		})
	}

	nextTaskAllClicked(evt: UIEvent) {
		if (!this.takeControl()) return;

		this.api.nextTaskAll().then(response => {
			if (response.message) {
				error(response.message)
			}
			else {
				info("Sent Next Task All")
			}
		})
	}

	recoverAllClicked(evt: UIEvent) {
		if (!this.takeControl()) return

		this.api.allRecover().then(response => {
				if (response.message) {
						error(response.message)
				}
				else {
						info("Sent Recover All")
				}
		})
	}

	runRCMode() {
		let botId = this.selectedBotId()
		if (botId == null) {
			warning("No bots selected")
			return
		}

		var datum_location = this.podStatus?.bots?.[botId]?.location 

		if (datum_location == null) {
			const warning_string = 'RC mode issued, but bot has no location.  Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

			if (!confirm(warning_string)) {
				return
			}

			datum_location = {lat: 0, lon: 0}
		}

		this.runMissions(Missions.RCMode(botId, datum_location))
	}

	runRCDive() {
		let botId = this.selectedBotId()
		if (botId == null) {
			warning("No bots selected")
			return
		}
		this.runMissions(Missions.RCDive(botId))
	}

	sendFlag(evt: UIEvent) {
		if (!this.takeControl()) return

		// Send a user flag, to get recorded in the bot's logs
		let botId = this.selectedBotIds().at(-1) || 0
		let engineeringCommand = {
			bot_id: botId,
			flag: this.flagNumber
		}

		this.api.postEngineering(engineeringCommand)
		info("Posted Flag " + this.flagNumber + " to bot " + botId)

		// Increment the flag number
		this.flagNumber ++
	}

	toggleMode(modeName: Mode) {
		if (this.state.mode == modeName) {
			if (this.state.mode) {
				let selectedButton = $('#' + this.state.mode)
				if (selectedButton) {
					selectedButton.removeClass('selected')
				}
			}

			this.state.mode = Mode.NONE
		}
		else {
			let button = $('#' + modeName)?.addClass('selected')
			this.state.mode = modeName
		}
	}

	disconnectionPanel() {
		let msg = this.state.disconnectionMessage
		if (msg == null) {
			return null
		}

		return <div className="disconnection shadowed rounded">
			<Icon path={mdiLanDisconnect} className="icon padded"></Icon>
			{msg}
		</div>
	}

	toggleEngineeringPanel() {
		let engineeringPanel = document.getElementById('engineeringPanel')
		if (engineeringPanel.style.width == "400px") {
			engineeringPanel.style.width = "0px"
		}
		else {
			engineeringPanel.style.width = "400px"
		}
	}

}

// =================================================================================================

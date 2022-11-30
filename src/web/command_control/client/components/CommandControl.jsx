/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/self-closing-comp */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/sort-comp */
/* eslint-disable react/no-danger */
/* eslint-disable max-len */
/* eslint-disable react/no-unused-state */
/* eslint-disable react/no-multi-comp */

import React from 'react'
import { Settings } from './Settings'
import { Missions } from './Missions'
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
// IndexedDB
import { openDB, deleteDB, wrap, unwrap } from 'idb';
import { idb } from 'idb';

import JSZip from 'jszip';

// Openlayers
import OlMap from 'ol/Map';
import {
	DragAndDrop as DragAndDropInteraction,
	Select as SelectInteraction,
	Translate as TranslateInteraction,
	Pointer as PointerInteraction,
	defaults as defaultInteractions,
} from 'ol/interaction';
import OlView from 'ol/View';
import OlIcon from 'ol/style/Icon'
import OlText from 'ol/style/Text'
import OlLayerGroup from 'ol/layer/Group';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceXYZ from 'ol/source/XYZ';
import OlTileWMS from 'ol/source/TileWMS';
import { TileArcGISRest} from 'ol/source';
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
import { createStringXY as OlCreateStringXY } from 'ol/coordinate';
import { unByKey as OlUnobserveByKey } from 'ol/Observable';
import { getLength as OlGetLength } from 'ol/sphere';
import { LineString as OlLineString } from 'ol/geom';
import OlDrawInteraction from 'ol/interaction/Draw';
import {
	Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlLayerSwitcher from 'ol-layerswitcher';
import OlAttribution from 'ol/control/Attribution';
import { getTransform } from 'ol/proj';
import { deepcopy, areEqual } from './Utilities';

import * as MissionFeatures from './gui/MissionFeatures'
import { createBotFeature } from './gui/BotFeature'

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
	faGripVertical,
	faCrosshairs,
	faChevronDown,
	faChevronLeft,
	faDharmachakra,
	faMapMarkerAlt,
	faMapPin,
	faMapMarkedAlt,
	faRuler,
	faEdit,
	faLayerGroup,
	faWrench
} from '@fortawesome/free-solid-svg-icons';


import jaiabot_icon from '../icons/jaiabot.png'

// const element = <FontAwesomeIcon icon={faCoffee} />

import {BotDetailsComponent, HubDetailsComponent} from './Details'
import { JaiaAPI, jaiaAPI } from '../../common/JaiaAPI';

import shapes from '../libs/shapes';
import tooltips from '../libs/tooltips';
import JsonAPI from '../../common/JsonAPI';

// jQuery UI touch punch
import punchJQuery from '../libs/jquery.ui.touch-punch';

import { error, success, warning, info} from '../libs/notifications';

// Don't use any third party css exept reset-css!
import 'reset-css';
// import 'ol-layerswitcher/src/ol-layerswitcher.css';
import '../style/CommandControl.less';
import { transform } from 'ol/proj';

import homeIcon from '../icons/rally-point-red.svg'
import rallyPointIcon from '../icons/rally-point-green.svg'
import missionOrientationIcon from '../icons/compass.svg'
import goToRallyGreen from '../icons/go-to-rally-point-green.png'
import goToRallyRed from '../icons/go-to-rally-point-red.png'

import taskNone from './gui/taskNone.svg'
import taskDive from './gui/taskDive.svg'
import taskDrift from './gui/taskDrift.svg'
import taskStationKeep from './gui/taskStationKeep.svg'

import { LoadMissionPanel } from './LoadMissionPanel'
import { SaveMissionPanel } from './SaveMissionPanel'
import SoundEffects from './SoundEffects'


// Must prefix less-vars-loader with ! to disable less-loader, otherwise less-vars-loader will get JS (less-loader
// output) as input instead of the less.
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
const lessVars = require('!less-vars-loader?camelCase,resolveVariables!../style/CommandControl.less');

const COLOR_SELECTED = lessVars.selectedColor;

punchJQuery($);
// jqueryDrawer($);

const { getBoatStyle } = shapes;

// Sorry, map is a global because it really gets used from everywhere
let map;
const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

const viewportDefaultPadding = 100;
const sidebarInitialWidth = 0;
const sidebarMinWidth = 0;
const sidebarMaxWidth = 1500;

const POLLING_INTERVAL_MS = 500

// export async function doDatabaseStuff() {
// 	const dbPromise = await openDB('tile-store', 1, {
// 		upgrade(db) {
// 			db.createObjectStore('tiles');
// 		},
// 		blocked() {
// 			// …
// 		},
// 		blocking() {
// 			// …
// 		},
// 		terminated() {
// 			// …
// 		},
// 	});
// }

export const idbStore = {
	db1: openDB("db1", 1,  {
		upgrade(db) {
			db.createObjectStore('store1');
		},
	})
}

export async function addToStore1(key, value) {
  return (await idbStore.db1).add("store1", value, key);
}

export async function getFromStore1(key) {
  return (await idbStore.db1).get("store1", key);
}

function saveVisibleLayers() {
	Settings.write("visibleLayers", visibleLayers)
}

let visibleLayers = new Set()

function loadVisibleLayers() {
	visibleLayers = new Set(Settings.read('visibleLayers') || ['OpenStreetMap', 'NOAA ENC Charts'])
}

function makeLayerSavable(layer) {
	let title = layer.get("title")

	// Set visible if it should be
	let visible = visibleLayers.has(title)
	layer.set("visible", visible)

	// Catch change in visible state
	layer.on("change:visible", () => {
		if (layer.getVisible()) {
			visibleLayers.add(title)
		}
		else {
			visibleLayers.delete(title)
		}
		saveVisibleLayers()
	})
}

loadVisibleLayers()

// ===========================================================================================================================

// ===========================================================================================================================

export default class CommandControl extends React.Component {

	constructor(props) {
		super(props);

		this.mapDivId = `map-${Math.round(Math.random() * 100000000)}`;

		this.api = jaiaAPI

		this.podStatus = {}

		this.missions = {}
		this.undoMissionsStack = []

		this.flagNumber = 1

		this.state = {
			error: {},
			// User interaction modes
			mode: '',
			currentInteraction: null,
			mapZoomLevel: 14,
			controlSpeed: 0,
			controlHeading: 0,
			accelerationProfileIndex: 0,
			commandDrawerOpen: false,
			// Map layers
			botsLayerCollection: new OlCollection([], { unique: true }),
			chartLayerCollection: new OlCollection([], { unique: true }),
			baseLayerCollection: new OlCollection([], { unique: true }),
			selectedBotsFeatureCollection: new OlCollection([], { unique: true }),
			liveCommand: {
				type: '',
				parameters: [],
				formationParameters: [0, 0, 0, 10]
			},
			// incoming data
			lastBotCount: 0,
			botExtents: {},
			trackingTarget: '',
			viewportPadding: [
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding + sidebarInitialWidth
			],
			selectedMissionAction: -1,
			measureFeature: null,
			measureActive: false,
			goalSettingsPanel: <GoalSettingsPanel />,
			homeLocation: null,
			rallyPointLocation: null,
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
			missionSettingsPanel: <MissionSettingsPanel />,
			surveyPolygonFeature: null,
			surveyPolygonActive: false,
			surveyPolygonGeoCoords: null,
			surveyPolygonCoords: null,
			surveyPolygonChanged: false,
			surveyExclusions: null,
			selectedFeatures: null,
			noaaEncSource: new TileArcGISRest({ url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer' }),
			detailsBoxItem: null
		};

		this.surveyExclusionsStyle = null;

		this.missionPlanMarkers = new Map();
		this.missionPlanMarkerExtents = new Map();

		const { chartLayerCollection } = this.state;

		this.chartLayerGroup = new OlLayerGroup({
			title: 'Overlays',
			layers: chartLayerCollection,
			fold: 'open'
		});

		const { baseLayerCollection } = this.state;

		// Configure the basemap layers
		[
			new OlTileLayer({
				title: 'NOAA ENC Charts',
				opacity: 0.7,
				zIndex: 20,
				source: this.state.noaaEncSource,
				wrapX: false
			}),
			new OlTileLayer({
				title: 'GEBCO Bathymetry',
				zIndex: 10,
				opacity: 0.7,
				source: new OlTileWMS({
					url: 'https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?',
					params: {'LAYERS': 'GEBCO_LATEST_2_sub_ice_topo', 'VERSION':'1.3.0','FORMAT': 'image/png'},
					serverType: 'mapserver',
					projection: 'EPSG:4326'
				}),
				wrapX: false
			})
		].forEach((layer) => {
			makeLayerSavable(layer);
			chartLayerCollection.push(layer);
		});

		this.chartLayerGroup = new OlLayerGroup({
			title: 'Charts and Imagery',
			layers: chartLayerCollection,
			fold: 'open'
		});

		// Configure the basemap layers
		[
			new OlTileLayer({
				title: 'Google Satellite & Roads',
				type: 'base',
				zIndex: 1,
				source: new OlSourceXYZ({ url: 'http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' }),
				wrapX: false
			}),
			new OlTileLayer({
				title: 'OpenStreetMap',
				type: 'base',
				zIndex: 1,
				source: new OlSourceOsm(),
				wrapX: false
			})
		].forEach((layer) => {
			makeLayerSavable(layer);
			baseLayerCollection.push(layer);
		});

		// Measure tool

		let measureSource = new OlVectorSource();

		this.measureLayer = new OlVectorLayer({
			source: measureSource,
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

		const {
			botsLayerCollection,
			selectedBotsFeatureCollection    } = this.state;

		this.botsLayerGroup = new OlLayerGroup({
			// title: 'Bots',
			// fold: 'open',
			layers: botsLayerCollection
		});

		// Create functions to extract KML and icons from KMZ array buffer, which must be done synchronously.
		const zip = new JSZip();

		function getKMLData(buffer) {
			let kmlData;
			zip.load(buffer);
			const kmlFile = zip.file(/\.kml$/i)[0];
			if (kmlFile) {
				kmlData = kmlFile.asText();
			}
			return kmlData;
		}

		function getKMLImage(href) {
			const index = window.location.href.lastIndexOf('/');
			if (index !== -1) {
				const kmlFile = zip.file(href.slice(index + 1));
				if (kmlFile) {
					return URL.createObjectURL(new Blob([kmlFile.asArrayBuffer()]));
				}
			}
			return href;
		}

		// Define a KMZ format class by subclassing ol/format/KML

		class KMZ extends KML {
			constructor(opt_options) {
				const options = opt_options || {};
				options.iconUrlFunction = getKMLImage;
				super(options);
			}

			getType() {
				return 'arraybuffer';
			}

			readFeature(source, options) {
				const kmlData = getKMLData(source);
				return super.readFeature(kmlData, options);
			}

			readFeatures(source, options) {
				const kmlData = getKMLData(source);
				return super.readFeatures(kmlData, options);
			}
		}

		// Define DragAndDrop interaction
		this.dragAndDropInteraction = new DragAndDropInteraction({
			formatConstructors: [KMZ, GPX, GeoJSON, IGC, KML, TopoJSON],
		});

		this.dragAndDropVectorLayer = new OlVectorLayer();

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
					undefinedHTML: '&nbsp;'
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
			loadTilesWhileAnimating: true,
			loadTilesWhileInteracting: true,
			moveTolerance: 20
		});

		// Set the map for the TaskData object, so it knows where to put popups, and where to get the projection transform
		taskData.map = map

		this.coordinate_to_location_transform = getTransform(map.getView().getProjection(), equirectangular)

		this.measureInteraction = new OlDrawInteraction({
			source: measureSource,
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

		let listener;
		this.measureInteraction.on(
			'drawstart',
			(evt) => {
				this.setState({ measureFeature: evt.feature });


				listener = evt.feature.getGeometry().on('change', (evt2) => {
					const geom = evt2.target;
					// tooltipCoord = geom.getLastCoordinate();
					$('#measureResult').text(CommandControl.formatLength(geom));
				});
			},
			this
		);

		this.measureInteraction.on(
			'drawend',
			() => {
				this.setState({ measureActive: false, measureFeature: null });
				OlUnobserveByKey(listener);
				this.changeInteraction();
			},
			this
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

		let surveyPolygonlistener;
		this.surveyPolygonInteraction.on(
			'drawstart',
			(evt) => {
				this.setState({
					surveyPolygonChanged: true,
					mode: 'missionPlanning',
					missionPlanningFeature: null
				});
				this.updateMissionLayer();

				surveyPolygonlistener = evt.feature.on('change', (evt2) => {
					const geom1 = evt2.target;

					const format = new GeoJSON();
					const turfPolygon = format.writeFeatureObject(geom1);

					if (turfPolygon.geometry.coordinates[0].length > 500) {

						let cellSide = this.state.missionParams.spacing;

						let options = {units: 'meters', mask: turf.toWgs84(turfPolygon)};

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

								let optionsMissionLines = {units: 'meters'};
								let bot_dict_length = Object.keys(this.podStatus.bots).length
								let bot_list = Array.from(Array(bot_dict_length).keys());
								let missionRhumbDestPoint = turf.rhumbDestination(missionPlanningGridTurfCentroid, this.state.missionParams.spacing * bot_dict_length, this.state.missionParams.orientation, optionsMissionLines);

								let centerLine = turf.lineString([missionPlanningGridTurfCentroid.geometry.coordinates, missionRhumbDestPoint.geometry.coordinates]);

								let lineSegments = [];
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



								let offsetLines = [];


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
								let b = []
								a.coordinates.forEach(coord => {
									b.push(format.readFeature(coord, {
										dataProjection: 'EPSG:4326',
										featureProjection: 'EPSG:3857'
									}).getGeometry().getCoordinates());
								})
								// console.log(b);
								// const missionPlanningLinesOl = format.readFeatures(turf.getGeom(missionPlanningLinesTurf), {
								// 	dataProjection: 'EPSG:4326',
								// 	featureProjection: 'EPSG:3857'
								// })

								let c = turf.getGeom(missionPlanningLinesTurf)
								let d = []
								c.coordinates.forEach(coord => {
									d.push(format.readFeature(turf.explode(coord).features[0], {
										dataProjection: 'EPSG:4326',
										featureProjection: 'EPSG:3857'
									}).getGeometry().getCoordinates())
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
			},
			this
		);

		this.surveyPolygonInteraction.on(
			'drawend',
			(evt) => {
				this.setState({
					surveyPolygonChanged: true,
					mode: 'missionPlanning',
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

				let geo_geom = evt.feature.getGeometry();
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
			},
			this
		);

		// Callbacks
		this.changeInteraction = this.changeInteraction.bind(this);

		this.setViewport = this.setViewport.bind(this);
		this.centerOn = this.centerOn.bind(this);
		this.fit = this.fit.bind(this);

		this.sendStop = this.sendStop.bind(this);

		// center persistence
		map.getView().setCenter(Settings.read("center") || equirectangular_to_mercator([-71.272237, 41.663559]))

		map.getView().on('change:center', function() {
			Settings.write('center', map.getView().getCenter())
		})

		// zoomLevel persistence
		map.getView().setZoom(Settings.read("zoomLevel") || 2)

		map.getView().on('change:resolution', function() {
			Settings.write('zoomLevel', map.getView().getZoom())
		})

		// rotation persistence
		map.getView().setRotation(Settings.read("rotation") || 0)

		map.getView().on('change:rotation', function() {
			Settings.write('rotation', map.getView().getRotation())
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
		this.generateMissions(this.state.surveyPolygonGeoCoords);
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

	setMissionState(missionParams) {
		this.setState({
			missionParams: missionParams
		})
	}

	cacheTileLoad() {
		this.state.noaaEncSource.setTileLoadFunction(function(tile, url) {
			const image = tile.getImage();

			getFromStore1(url).then(blob => {
				if (!blob) {
					// use online url
					image.src = url;

					// Let's add the tile to the cache since we missed it
					fetch(url).then(response => {
						if (response.ok) {
							response.blob().then(blob => {
								addToStore1(url, blob).then(p => {
									// console.log('added urlkey1 to store');
									// console.log(p);
								}).catch(() => {
									// console.log('urlkey1 already exists');
								});
							});
						}
					});
					return;
				}

				const objUrl = URL.createObjectURL(blob);
				image.onload = function() {
					URL.revokeObjectURL(objUrl);
				};
				image.src = objUrl;
			}).catch(() => {
				image.src = url;

				// Let's add the tile to the cache since we missed it
				fetch(url).then(response => {
					if (response.ok) {
						response.blob().then(blob => {
							addToStore1(url, blob).then(p => {
								// console.log('added urlkey1 to store');
								// console.log(p);
							}).catch(() => {
								// console.log('urlkey1 already exists');
							});
						});
					}
				});
			});
		})
	}


	createLayers() {
		this.missionLayer = new OlVectorLayer();
		this.missionPlanningLayer = new OlVectorLayer({
			name: 'missionPlanningLayer',
			title: 'Mission Planning'
		});
		this.exclusionsLayer = new OlVectorLayer({
			name: 'exclusionsLayer',
			title: 'Mission Exclusion Areas'
		});

		this.cacheTileLoad();

		this.measurementLayerGroup = new OlLayerGroup({
			title: 'Measurements',
			fold: 'close',
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

		let layers = [
			new OlLayerGroup({
				title: 'Map',
				fold: 'open',
				layers: this.state.baseLayerCollection
			}),
			this.chartLayerGroup,
			this.measurementLayerGroup,
			this.graticuleLayer,
			this.measureLayer,
			this.missionLayer,
			this.missionPlanningLayer,
			this.exclusionsLayer,
			this.botsLayerGroup,
			this.dragAndDropVectorLayer,
		]

		// console.log(layers)

		return layers
	}

	componentDidMount() {

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

		$('.panel > h2').disableSelection();

		map.getView().on('change:resolution', () => {
			this.setState({
				mapZoomLevel: map.getView().getZoom()
			});
		});

		/*
		This needs to be called whenever liveCommand is updated externally, but NOT in the render method
		*/

		const { controlSpeed } = this.state;
		$('#speedSlider').slider({
			max: 100,
			min: 0,
			orientation: 'horizontal',
			value: controlSpeed,
			slide(ui) {
				us.sendThrottle(ui.value);
			}
		});

		OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'));

		$('button').disableSelection();

		tooltips();

		$('#mapLayers').hide('blind', { direction: 'right' }, 0);


		// Undo button
		function KeyPress(e) {
			let evtobj = window.event? event : e
			if (evtobj.keyCode == 90 && evtobj.ctrlKey) {
				this.restoreUndo()
			}
		}

		document.onkeydown = KeyPress.bind(this)

		this.state.missionBaseGoal.task = {
			type: "DIVE",
			dive: {
				max_depth: 10,
				depth_interval: 10,
				hold_time: 1
			},
			surface_drift: {
				drift_time: 10
			}
		}

		map.on('doubleclick', function (evt) {
			document.getElementById('layerinfo').innerHTML = '';
			const viewResolution = /** @type {number} */ (map.getView().getResolution());
			let layer_array = us.state.baseLayerCollection.getArray();
			let theSource = layer_array.find(x => x.values_.title==="GEBCO Bathymetry");
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
		this.dragAndDropInteraction.on('addfeatures', function (event) {
			const vectorSource = new OlVectorSource({
				features: event.features,
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

		const round = (value, precision) => {
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
		const surveyExclusionsStyle = function(feature) {
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

		let surveyExclusionslistener;
		this.surveyExclusionsInteraction.on(
			'drawstart',
			(evt) => {
				this.setState({
					surveyExclusions: null
				})
				this.updateMissionLayer();

				// Show the preview of the survey
				surveyLineslistener = evt.feature.on('change', (evt2) => {
					this.updateMissionLayer();
					// console.log('surveyExclusions changed...')
				})
			},
			this
		);

		this.surveyExclusionsInteraction.on(
			'drawend',
			(evt) => {
				// console.log('surveyExclusionsInteraction drawend');

				let featuresExclusions = [];

				let surveyExclusionsFeature = new OlFeature(
					{
						geometry: new OlLineString(turf.coordAll(turf.polygon(evt.feature.getGeometry().getCoordinates()))),
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
					surveyExclusions: turf.coordAll(turf.polygon(evt.feature.getGeometry().getCoordinates()))
				})
				OlUnobserveByKey(surveyExclusionslistener);
			},
			this
		);

		// Survey planning using lines
		let surveyLineStyle = function(feature) {

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
				rhumbDist = Number(rhumbDist.toFixed(2)).toString();
				if (homeLocation !== null) {
					rhumbHomeDist = turf.rhumbDistance(turf.toWgs84(turf.point(stringCoords[nextIndex])), turf.point([homeLocation.lon, homeLocation.lat]), {units: 'kilometers'});
					rhumbHomeDist = Number(rhumbHomeDist.toFixed(2)).toString();
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

		let surveyLineslistener;
		this.surveyLinesInteraction.on(
			'drawstart',
			(evt) => {
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


						let centerLine = turf.getGeom(centerLineFc).features[0];
						let currentLineLength = turf.length(centerLine)



						if (currentLineLength <= maxLineLength-(Number(missionParams.spacing)/1000)) {
							let offsetLines = [];
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

							let alongLines = {};
							let alongPoints = {};
							offsetLines.forEach(offsetLine => {
								turf.geomEach(offsetLine, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
									let botId = featureProperties.botId;
									alongLines[botId] = turf.toMercator(currentGeometry).coordinates
								});
								if (this.state.surveyExclusions) {
									let alongPointsBeforeExclusion = turf.coordAll(turf.cleanCoords(turf.multiPoint(round(turf.coordAll(turf.explode(offsetLine)), 7))))
									let alongPointsAfterExclusion = []
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
									alongPoints[Number(offsetLine.properties.botId)] = turf.coordAll(turf.toMercator(turf.multiPoint(alongPointsAfterExclusion)))
								} else {
									alongPoints[Number(offsetLine.properties.botId)] = turf.coordAll(turf.toMercator(turf.cleanCoords(turf.multiPoint(round(turf.coordAll(turf.explode(offsetLine)), 7)))))
								}
							})

							// Metadata setup
							// TODO: Add hub position so we can get a distance to furthest point away from it, no LL atm
							// console.log('hubs');
							// console.log(Object.values(this.podStatus?.hubs ?? {}));
							let fcInput = []
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

							missionParams.sp_rally_start_dist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[0], turf.point([this.state.rallyPointLocation.lon, this.state.rallyPointLocation.lat])), 2)
							missionParams.sp_rally_finish_dist = round(turf.distance(centerLineStringWgs84.geometry.coordinates[1], turf.point([this.state.homeLocation.lon, this.state.homeLocation.lat])), 2)

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
			},
			this
		);

		this.surveyLinesInteraction.on(
			'drawend',
			(evt) => {
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
			},
			this
		);

		info('Welcome to JaiaBot Command & Control!');
	}

	componentDidUpdate(prevProps, prevState, snapshot) {
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
		clearInterval(this.timerID);
		clearTimeout(this.accelTimer);
	}

	getLiveLayerFromBotId(bot_id) {
		const { botsLayerCollection } = this.state;
		// eslint-disable-next-line no-plusplus
		for (let i = 0; i < botsLayerCollection.getLength(); i++) {
			const layer = botsLayerCollection.item(i);
			if (layer.bot_id === bot_id) {
				return layer;
			}
		}

		const botFeature = new OlFeature({
			name: bot_id,
			geometry: new OlPoint([0, 0])
		});

		botFeature.setId(bot_id);
		botFeature.setStyle(getBoatStyle(map));

		const botLayer = new OlVectorLayer({
			name: bot_id,
			title: bot_id,
			source: new OlVectorSource({
				wrapX: false,
				features: new OlCollection([botFeature], { unique: true })
			})
		});

		botLayer.setStyle(getBoatStyle(map));

		botLayer.bot_id = bot_id;

		botsLayerCollection.push(botLayer);

		OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'));
		// $('input').checkboxradio();

		return botsLayerCollection.item(botsLayerCollection.getLength() - 1);
	}

	changeInteraction(newInteraction = null, cursor = '') {
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


	setViewport(dims) {
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

	setViewportEdge(edge, padding) {
		const { viewportPadding } = this.state;
		viewportPadding[edge] = viewportDefaultPadding + padding;
		this.setState({
			viewportPadding
		});
	}

	centerOn(coords, stopTracking = false, firstMove = false) {
		if (isNaN(coords[0]) || isNaN(coords[1])) {
			return
		}

		if (stopTracking) {
			this.trackBot('');
		}

		const floatCoords = [parseFloat(coords[0]), parseFloat(coords[1])];
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

	fit(geom, opts, stopTracking = false, firstMove = false) {
		if (isNaN(geom[0]) || isNaN(geom[1]) || isNaN(geom[2]) || isNaN(geom[3])) {
			return
		}

		if (stopTracking) {
			this.trackBot('');
		}
		const { viewportPadding } = this.state;
		const size = map.getSize();
		const origZoom = map.getView().getZoom();
		const newRes = map.getView().getResolutionForExtent(geom, size);
		const optsOverride = {};
//     if (!firstMove) {
		optsOverride.maxZoom = origZoom;
//     }
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

	/*updateHubsLayer() {
		let hubs = this.podStatus.hubs;

		for (let hubId in hubs) {
			let hub = hubs[hubId];

			// ID
			const hub_id = hub.hub_id
			// Geometry
			const hubLatitude = hub.location?.lat
			const hubLongitude = hub.location?.lon
		}
	}*/

	updateBotsLayer() {
		const { selectedBotsFeatureCollection } = this.state;
		let bots = this.podStatus.bots

		let faultLevel0Count = 0;
		let faultLevel1Count = 0;
		let faultLevel2Count = 0;

		const { trackingTarget } = this.state;

		const botExtents = {};

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
				botId: botId,
				lonLat: [botLongitude, botLatitude],
				heading: botHeading,
				courseOverGround: bot.attitude?.course_over_ground
			})

			botFeature.setId(bot_id);

			const coordinate = equirectangular_to_mercator([parseFloat(botLongitude), parseFloat(botLatitude)]);

			// Fault Levels

			let faultLevel = 0

			switch(bot.health_state) {
				case "HEALTH__OK":
					faultLevel = 0
					faultLevel0Count ++
					break;
				case "HEALTH__DEGRADED":
					faultLevel = 1
					faultLevel1Count ++
					break;
				default:
					faultLevel = 2
					faultLevel2Count ++
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
				lastUpdated: parseFloat(bot.time),
				lastUpdatedString: botTimestamp.toISOString(),
				missionState: bot.mission_state,
				healthState: bot.health_state,
				faultLevel: faultLevel,
				isDisconnected: bot.isDisconnected,
				botId: botId
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
		const botCount = bots.length;
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
					this.podStatus = {}
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

					this.updateBotsLayer()
					//this.updateHubsLayer()
					if (this.state.mode !== 'missionPlanning') {
						this.updateMissionLayer()
					}
				}
			},
			(err) => {
				this.setState({
					error: err
				});
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
		this.botsLayerGroup.getLayers().forEach((layer) => {
			if (layer.getSource().getFeatures().length <= 0) return;
			OlExtendExtent(extent, layer.getSource().getExtent());
			layerCount += 1;
		});
		if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
	}

	zoomToAll(firstMove = false) {
		const extent = OlCreateEmptyExtent();
		let layerCount = 0;
		const addExtent = (layer) => {
			if (layer.getSource().getFeatures().length <= 0) return;
			OlExtendExtent(extent, layer.getSource().getExtent());
			layerCount += 1;
		};
		this.botsLayerGroup.getLayers().forEach(addExtent);
		if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
	}

	selectBot(bot_id) {
		this.selectBots([bot_id]);
	}

	selectBots(bot_ids) {
		bot_ids = bot_ids.map(bot_id => { return Number(bot_id) })

		const { botsLayerCollection, selectedBotsFeatureCollection } = this.state;
		selectedBotsFeatureCollection.clear();
		botsLayerCollection.getArray().forEach((layer) => {
			const feature = layer.getSource().getFeatureById(layer.bot_id);
			if (feature) {
				if (bot_ids.includes(feature.getId())) {
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

	isBotSelected(bot_id) {
		const { selectedBotsFeatureCollection } = this.state;
		for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
			if (selectedBotsFeatureCollection.item(i).getId() == bot_id) {
				return true;
			}
		}
		return false;
	}

	zoomToBot(id, firstMove = false) {
		const { botExtents } = this.state;
		this.fit(botExtents[id], { duration: 100 }, false, firstMove);
	}

	trackBot(id) {
		const { trackingTarget } = this.state;
		if (id === trackingTarget) return;
		this.setState({ trackingTarget: id });
		if (id === 'all') {
			this.zoomToAll(true);
			info('Following all');
		} else if (id === 'pod') {
			this.zoomToAllBots(true);
			info('Following pod');
		} else if (id !== '') {
			this.zoomToBot(id, true);
			info(`Following bot ${id}`);
		} else if (trackingTarget === 'all') {
			info('Stopped following all');
		} else if (trackingTarget === 'pod') {
			info('Stopped following pod');
		} else {
			info(`Stopped following bot ${trackingTarget}`);
		}
	}

	changeMissions(func) {
		// Save a backup of the current mission set
		let oldMissions = deepcopy(this.missions)

		// Do any alterations to the mission set
		func(this.missions)

		// If something was changed
		if (oldMissions != this.missions) {
			// then place the old mission set into the undoMissions
			this.undoMissionsStack.push(deepcopy(oldMissions))

			// Update the mission layer to reflect changes that were made
			this.updateMissionLayer()
		}
	}

	restoreUndo() {
		if (this.undoMissionsStack.length > 1) {
			this.missions = this.undoMissionsStack.pop()
			this.setState({goalBeingEdited: null})
			this.updateMissionLayer()
		}
	}

	sendStop() {
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

		let returnToHomeMissions = this.selectedBotIds().map(selectedBotId => Missions.missionWithWaypoints(selectedBotId, this.state.homeLocation))

		this.runMissions(returnToHomeMissions)
	}

	static formatLength(line) {
		const length = OlGetLength(line, { projection: mercator });
		if (length > 100) {
			return `${Math.round((length / 1000) * 100) / 100} km`;
		}
		return `${Math.round(length * 100) / 100} m`;
	}

	// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
	// eslint-disable-next-line class-methods-use-this

	render() {
		const {
			selectedBotsFeatureCollection,
			botsLayerCollection,
			trackingTarget,
			measureActive,
			surveyPolygonActive
		} = this.state;
		
		let self = this

		let bots = this.podStatus?.bots
		let hubs = this.podStatus?.hubs

		let goalSettingsPanel = '';
		if (this.state.goalBeingEdited != null) {
			goalSettingsPanel = <GoalSettingsPanel goal={this.state.goalBeingEdited} onChange={() => {this.updateMissionLayer()}} onClose={() => { this.state.goalBeingEdited = null }} />
		}

		// Add mission generation form to UI if the survey polygon has changed.
		let missionSettingsPanel = '';
		if (this.state.mode === 'missionPlanning') {
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
						this.genMission(this.state.surveyPolygonGeoCoords)
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
				detailsBox = HubDetailsComponent(hubs?.[detailsBoxItem.id], this.api, closeDetails);
				
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
												closeDetails);
				break;
			case null:
				detailsBox = null;
				break;
		}

		return (
			<div id="axui_container">

				<EngineeringPanel api={this.api} bots={bots} getSelectedBotId={this.selectedBotId.bind(this)} />

				<div id={this.mapDivId} className="map-control" />

				<div id="mapLayers" />

				<div id="layerinfo">&nbsp;</div>

				<div id="viewControls">
					<Button
						className="button-jcc"
						onClick={() => {
							$('#mapLayers').toggle('blind', { direction: 'right' });
							$('#mapLayersButton').toggleClass('active');
						}}
					>
						<FontAwesomeIcon icon={faLayerGroup} />
					</Button>
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
								<FontAwesomeIcon icon={faRuler} />
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
							<FontAwesomeIcon icon={faRuler} />
						</Button>
					)}
					{trackingTarget === 'all' ? (
						<Button onClick={this.trackBot.bind(this, '')} className="button-jcc active">
							<FontAwesomeIcon icon={faMapMarkedAlt} />
						</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.zoomToAll(true);
								this.trackBot('all');
							}}
							title="Follow All"
						>
							<FontAwesomeIcon icon={faMapMarkedAlt} />
						</Button>
					)}
					{trackingTarget === 'pod' ? (
						<Button onClick={this.trackBot.bind(this, '')} className="button-jcc active">
							<FontAwesomeIcon icon={faMapMarkerAlt} />
						</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.zoomToAllBots(true);
								this.trackBot('pod');
							}}
						>
							<FontAwesomeIcon icon={faMapMarkerAlt} />
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
								<FontAwesomeIcon icon={faEdit} />
							</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.setState({ surveyPolygonActive: true, mode: 'missionPlanning' });
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
							<FontAwesomeIcon icon={faEdit} />
						</Button>
					)}

					<Button className="button-jcc" onClick={ this.toggleEngineeringPanel.bind(this) }>
						<FontAwesomeIcon icon={faWrench} />
					</Button>

					<img className="jaia-logo button" src="/favicon.png" onClick={() => { 
						alert("Jaia Robotics\nAddress: 22 Burnside St\nBristol\nRI 02809\nPhone: P: +1 401 214 9232\n"
							+ "Comnpany Website: https://www.jaia.tech/\nDocumentation: http://52.36.157.57/index.html\n") 
						}}>	
					</img>

				</div>

				<div id="botsDrawer">
					{this.botsList()}
					<div id="jaiabot3d" style={{"zIndex":"10", "width":"50px", "height":"50px", "display":"none"}}></div>
				</div>

				{detailsBox}

				{goalSettingsPanel}

				{missionSettingsPanel}

				{this.commandDrawer()}

				{this.state.loadMissionPanel}

				{this.state.saveMissionPanel}

				{this.disconnectionPanel()}
				
			</div>
		);
	}

	locationFromCoordinate(coordinate) {
		let latlon = this.coordinate_to_location_transform(coordinate)
		return {lat: latlon[1], lon: latlon[0]}
	}

	addWaypointAtCoordinate(coordinate) {
		this.addWaypointAt(this.locationFromCoordinate(coordinate))
	}

	addWaypointAt(location) {
		let botId = this.selectedBotIds().at(-1)

		if (botId == null) {
			return
		}

		this.changeMissions((missions) => {

			if (!(botId in missions)) {
				missions[botId] = {
					botId: botId,
					time: '1642891753471247',
					type: 'MISSION_PLAN',
					plan: {
						start: 'START_IMMEDIATELY',
						movement: 'TRANSIT',
						goal: [],
						recovery: {recoverAtFinalGoal: true}
					}
				}
			}

			missions[botId].plan.goal.push({location: location})

		})
	}

	setGrid2Style(self, feature, taskType) {
		let gridStyle = new OlIcon({ src: taskNone })

		switch(taskType) {
			case 'DIVE':
				gridStyle = new OlIcon({ src: taskDive })
				break;
			case 'SURFACE_DRIFT':
				gridStyle = new OlIcon({ src: taskDrift })
				break;
			case 'STATION_KEEP':
				gridStyle = new OlIcon({ src: taskStationKeep })
				break;
			case 'NONE':
				gridStyle = new OlIcon({ src: taskNone })
				break;
			default:
				break;
		}

		let s = new OlStyle({
			image: gridStyle
		})

		return [s]
	}

	setGridStyle(self, taskType) {

		// console.log(taskType);

		let gridStyle = new OlIcon({ src: taskNone })

		switch(taskType) {
			case 'DIVE':
				gridStyle = new OlIcon({ src: taskDive })
				break;
			case 'SURFACE_DRIFT':
				gridStyle = new OlIcon({ src: taskDrift })
				break;
			case 'STATION_KEEP':
				gridStyle = new OlIcon({ src: taskStationKeep })
				break;
			case 'NONE':
				gridStyle = new OlIcon({ src: taskNone })
				break;
			default:
				break;
		}

		return gridStyle
	}

	surveyStyle(self, feature, taskType) {
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
			let stringCoords = feature.getGeometry().getCoordinates();
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
				rhumbDist = Number(rhumbDist.toFixed(2)).toString();
				if (homeLocation !== null) {
					rhumbHomeDist = turf.rhumbDistance(turf.toWgs84(turf.point(stringCoords[nextIndex])), turf.point([homeLocation.lon, homeLocation.lat]), {units: 'kilometers'});
					rhumbHomeDist = Number(rhumbHomeDist.toFixed(2)).toString();
				}
			}

			return [lineStyle, iconStyle];
		};

	setSurveyStyle(self, feature, taskType) {
		let featureStyles = this.surveyStyle(self, feature, taskType);
		feature.setStyle(featureStyles);
		return feature
	}

	setGridFeatureStyle(self, feature, taskType) {
		if (feature) {
			let gridStyle = this.setGrid2Style(self, feature, taskType);
			feature.setStyle(gridStyle);
		}
		return feature
	}

	findRallySeparation(bot_list, feature, rotationAngle, rallySpacing) {
		// Bot rally point separation scheme
		let rallyPoints = {};
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
			let rhumbDestinationPoints = [];
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

		let homeStyle = new OlStyle({
			image: new OlIcon({
				src: homeIcon,
				scale: [0.5, 0.5]
			})
		})

		let rallyPointStyle = new OlStyle({
			image: new OlIcon({
				src: rallyPointIcon,
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

			let selected = this.isBotSelected(botId)

			let goals = missions[botId]?.plan?.goal || []

			let active_goal_index = this.podStatus?.bots?.[botId]?.active_goal

			// Add our goals
			const missionFeatures = MissionFeatures.createMissionFeatures(map, missions[botId], active_goal_index, selected)
			features.push(...missionFeatures)
		}

		// Add Home, if available
		if (this.state.homeLocation) {
			let pt = equirectangular_to_mercator([this.state.homeLocation.lon, this.state.homeLocation.lat])
			let homeFeature = new OlFeature({ geometry: new OlPoint(pt) })
			homeFeature.setStyle(homeStyle)
			features.push(homeFeature)
		}

		if (this.state.rallyPointLocation) {
			let pt = equirectangular_to_mercator([this.state.rallyPointLocation.lon, this.state.rallyPointLocation.lat])
			let rallyPointFeature = new OlFeature({ geometry: new OlPoint(pt) })
			rallyPointFeature.setStyle(rallyPointStyle)
			features.push(rallyPointFeature)
		}

		if (this.state.surveyPolygonCoords) {
			let pts = this.state.surveyPolygonCoords.getCoordinates()[0];
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
			let missionPlans = {};
			let millisecondsSinceEpoch = new Date().getTime();
			let bot_list = Object.keys(this.podStatus.bots);

			// Bot rally point separation scheme
			let rallyStartPoints = this.findRallySeparation(deepcopy(bot_list), this.state.rallyPointLocation, this.state.missionParams.orientation, this.state.missionParams.rally_spacing);
			// console.log('rallyStartPoints');
			// console.log(rallyStartPoints);
			let rallyFinishPoints = this.findRallySeparation(deepcopy(bot_list), this.state.homeLocation, this.state.missionParams.orientation, this.state.missionParams.rally_spacing);
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
				let bot_goal = {
					"location": {
						"lat": rallyStartPoints[key][1],
						"lon": rallyStartPoints[key][0]
					},
					"task": {"type": "STATION_KEEP"}
				}
				bot_goals.push(bot_goal)

				// Mission Goals
				mpg[key].forEach(goal => {
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
					"task": {"type": "STATION_KEEP"}
				}
				bot_goals.push(bot_goal)

				let mission_dict = {
					botId: Number(key),
					time: millisecondsSinceEpoch,
					type: "MISSION_PLAN",
					plan: {
						start: "START_IMMEDIATELY",
						movement: "TRANSIT",
						goal: bot_goals,
						recovery: {
							recoverAtFinalGoal: true
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

			if (this.state.missionParams.mission_type === 'lines' && this.state.mode === 'missionPlanning') {
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
			features: features
		})

		this.missionLayer.setSource(vectorSource)
		this.missionLayer.setZIndex(1000)
	}

	// Runs a mission
	_runMission(bot_mission) {
		// Set the speed values
		let speeds = Settings.read('mission.plan.speeds')
		if (speeds != null && bot_mission.plan != null) {
			bot_mission.plan.speeds = speeds
		}

		console.debug('Running Mission:')
		console.debug(bot_mission)

		this.api.postCommand(bot_mission).then(response => {
			if (response.message) {
				error(response.message)
			}
		})
	}

	// Runs a set of missions, and updates the GUI
	runMissions(missions) {
		let botIds = Object.keys(missions)
		botIds.sort()

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

	// Loads the set of missions, and updates the GUI
	loadMissions(missions) {
		this.missions = deepcopy(missions)

		// selectedBotId is a placeholder for the currently selected botId
		if ('selectedBotId' in this.missions) {
			let selectedBotId = this.selectedBotId() ?? 0
			
			this.missions[selectedBotId] = this.missions['selectedBotId']
			this.missions[selectedBotId].bot_id = selectedBotId
			delete this.missions['selectedBotId']
		}

		this.updateMissionLayer()
	}

	// Currently selected botId
	selectedBotId() {
		return this.selectedBotIds().at(-1)
	}

	// Loads a hardcoded mission
	loadHardcodedMission(index) {
		let botId = this.selectedBotId() || 0
		let mission = Missions.hardcoded(botId, index)
		this.missions[botId] = mission
		this.updateMissionLayer()
		info("Loaded mission")
		console.debug(botId, mission)
	}

	// Runs the currently loaded mission
	runLoadedMissions(botIds=[]) {
		if (botIds.length == 0) {
			botIds = Object.keys(this.missions)
		}

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

	// Clears the currently active mission
	// trash button, delete button, clear button
	deleteClicked() {
		let selectedBotId = this.selectedBotId()
		let botString = (selectedBotId == null) ? "ALL Bots" : "Bot " + selectedBotId

		if (confirm('Delete mission for ' + botString + '?')) {
			if (selectedBotId != null) {
				this.changeMissions(() => {
					delete this.missions[selectedBotId]
				})
			}
			else {
				this.changeMissions(() => {
					this.missions = {}
				})
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
		let botIds = []

		// Update feature in selected set
		for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
			const feature = selectedBotsFeatureCollection.item(i)
			botIds.push(feature.getId())
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

	handleEvent(evt) {
		switch(evt.type) {
			case 'click':
				return this.clickEvent(evt)
				// break;
			case 'dragging':
				return
		}
		return true
	}

	clickEvent(evt) {
		const map = evt.map;

		if (this.state.mode == 'setHome') {
			this.placeHomeAtCoordinate(evt.coordinate)
			return false // Not a drag event
		}

		if (this.state.mode =='setRallyPoint') {
			this.placeRallyPointAtCoordinate(evt.coordinate)
			return false // Not a drag event
		}

		const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
			return feature
		});

		if (feature) {

			// Clicked on a goal / waypoint
			if (feature.goal != null) {
				this.state.goalBeingEdited = feature.goal
				return false
			}

			// Clicked on a bot
			if (this.isBotSelected(feature.getId())) {
				this.selectBots([])
			}
			else {
				this.selectBots([feature.getId()])
			}

			// Clicked on mission planning point
			if (feature.goal === null) {
				if (this.state.mode === 'missionPlanning') {
					this.state.selectedFeatures = feature;
				}
			}
		}
		else {
			this.addWaypointAtCoordinate(evt.coordinate)
		}

		return true
	}

	placeHomeAtCoordinate(coordinate) {
		let lonlat = mercator_to_equirectangular(coordinate)
		let location = {lon: lonlat[0], lat: lonlat[1]}

		this.setState({
			homeLocation: location,
			mode: ''
		})

		this.toggleMode('setHome')
		this.updateMissionLayer()
	}

	placeRallyPointAtCoordinate(coordinate) {
		let lonlat = mercator_to_equirectangular(coordinate)
		let location = {lon: lonlat[0], lat: lonlat[1]}
		this.setState({
			rallyPointLocation: location,
			mode: ''
		})

		this.toggleMode('setRallyPoint')
		this.updateMissionLayer()
	}

	stopDown(evt) {
		return false
	}

	generateMissions(surveyPolygonGeoCoords) {
		let bot_list = [];
		for (const bot in this.podStatus.bots) {
			bot_list.push(this.podStatus.bots[bot]['bot_id'])
		}

		this.api.postMissionFilesCreate({
			"bot_list": bot_list,
			"sample_spacing": this.state.missionParams.spacing,
			"mission_type": this.state.missionBaseGoal.task,
			"orientation": this.state.missionParams.orientation,
			"home_lon": this.state.homeLocation['lon'],
			"home_lat": this.state.homeLocation['lat'],
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
				<Button className="button-jcc" id="setRallyPoint" onClick={this.setRallyPointClicked.bind(this)}>
					<img src={rallyPointIcon} alt="Set Rally Point"></img>
				</Button>
				<Button className="button-jcc inactive" id="goToRallyGreen" disabled>
					<img src={goToRallyGreen} alt="Go To Rally Green"></img>
				</Button>
				<Button className="button-jcc" id="setHome" onClick={this.setHomeClicked.bind(this)}>
					<img src={homeIcon} alt="Set Rally Finish"></img>
				</Button>
				<Button className="button-jcc" id="goHome" onClick={this.goHomeClicked.bind(this)}>
					<img src={goToRallyRed} alt="Go To Rally Red"></img>
				</Button>
				<Button className="button-jcc" style={{"backgroundColor":"#cc0505"}} onClick={this.sendStop.bind(this)}>
				    <Icon path={mdiStop} title="Stop All Missions"/>
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
		let disabled = (this.undoMissionsStack.length == 0)
		let inactive = disabled ? " inactive" : ""
		return (<Button className={"globalCommand" + inactive + " button-jcc"} onClick={this.restoreUndo.bind(this)} disabled={disabled}><Icon path={mdiArrowULeftTop} title="Undo"/></Button>)
	}

	setHomeClicked(evt) {
		this.toggleMode('setHome')
	}

	setRallyPointClicked(evt) {
		this.toggleMode('setRallyPoint')
	}

	goHomeClicked(evt) {
		this.returnToHome()
	}

	playClicked(evt) {
		this.runLoadedMissions(this.selectedBotIds())
	}
	
	activateAllClicked(evt) {
		this.api.allActivate().then(response => {
			if (response.message) {
				error(response.message)
			}
			else {
				info("Sent Activate All")
			}
		})
	}

	nextTaskAllClicked(evt) {
		this.api.nextTaskAll().then(response => {
			if (response.message) {
				error(response.message)
			}
			else {
				info("Sent Next Task All")
			}
		})
	}

        recoverAllClicked(evt) {
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

	sendFlag(evt) {
		// Send a user flag, to get recorded in the bot's logs
		let botId = this.selectedBotIds().at(-1) || 0
		let engineeringCommand = {
			botId: botId,
			flag: this.flagNumber
		}

		this.api.postEngineering(engineeringCommand)
		info("Posted Flag " + this.flagNumber + " to bot " + botId)

		// Increment the flag number
		this.flagNumber ++
	}

	toggleMode(modeName) {
		if (this.state.mode == modeName) {
			if (this.state.mode) {
				let selectedButton = $('#' + this.state.mode)
				if (selectedButton) {
					selectedButton.removeClass('selected')
				}
			}

			this.state.mode = ""
		}
		else {
			let button = $('#' + modeName)?.addClass('selected')
			this.state.mode = modeName
		}
	}

	botsList() {
		let self = this

		let bots = Object.values(this.podStatus?.bots ?? {})
		let hubs = Object.values(this.podStatus?.hubs ?? {})
		
		function compare_by_hubId(hub1, hub2) {
			return hub1.hub_id - hub2.hub_id
		}

		function compare_by_botId(bot1, bot2) {
			return bot1.bot_id - bot2.bot_id
		}

		function bothub_to_div(bothub) {
			let botId = bothub.bot_id
			let hubId = bothub.hub_id
			
			if (botId != null) {
				var key = 'bot-' + botId
				var bothubClass = 'bot-item'

				var onClickFunction = () => {
					if (self.isBotSelected(botId)) {
						self.selectBots([])
					}
					else {
						self.selectBot(botId)
					}
				}
			}
			else {
				var key = 'hub-' + hubId
				var bothubClass = 'hub-item'

				var onClickFunction = () => {
					const item = {'type': 'hub', id: hubId}

					if (areEqual(self.state.detailsBoxItem, item)) {
						self.setState({detailsBoxItem: null})
					}
					else {
						self.setState({detailsBoxItem: item})
					}
				}
			}

			let faultLevel = {
				'HEALTH__OK': 0,
				'HEALTH__DEGRADED': 1,
				'HEALTH__FAILED': 2
			}[bothub.health_state] ?? 0

			let faultLevelClass = 'faultLevel' + faultLevel
			let selected = self.isBotSelected(botId) ? 'selected' : ''
			let tracked = botId === self.state.trackingTarget ? ' tracked' : ''

			//For now we are naming HUB, HUB with no id
			//In the future we will have to revisit this
			return (
				<div
					key={key}
					onClick={
						onClickFunction
					}
					className={`${bothubClass} ${faultLevelClass} ${selected} ${tracked}`}
				>
					{botId ?? "HUB"} 
				</div>
			);
		}


		return (
			<div id="botsList">
				{
					hubs.sort(compare_by_hubId).map(bothub_to_div)
				}
				{
					bots.sort(compare_by_botId).map(bothub_to_div)
				}
			</div>
		)
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

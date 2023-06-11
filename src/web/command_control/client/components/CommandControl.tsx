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
import { Save, GlobalSettings } from './Settings'
import { Missions } from './Missions'
import { GoalSettingsPanel } from './GoalSettings'
import { MissionSettingsPanel, MissionSettings, MissionParams } from './MissionSettings'
import { MissionLibraryLocalStorage } from './MissionLibrary'
import EngineeringPanel from './EngineeringPanel'
import MissionControllerPanel from './mission/MissionControllerPanel'
import { taskData } from './TaskPackets'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiPlay, 
	mdiLanDisconnect, mdiCheckboxMarkedCirclePlusOutline, 
	mdiFlagVariantPlus, mdiArrowULeftTop,
    mdiStop, mdiViewList} from '@mdi/js'

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
	Interaction,
} from 'ol/interaction';
import OlIcon from 'ol/style/Icon'
import OlText from 'ol/style/Text'
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import OlPoint from 'ol/geom/Point';
import OlMultiPoint from 'ol/geom/MultiPoint';
import OlMultiLineString from 'ol/geom/MultiLineString';
import OlFeature from 'ol/Feature';
import { createEmpty as OlCreateEmptyExtent, extend as OlExtendExtent } from 'ol/extent';
import { Coordinate } from 'ol/coordinate';
import { unByKey as OlUnobserveByKey } from 'ol/Observable';
import { getLength as OlGetLength } from 'ol/sphere';
import { Geometry, LineString, MultiLineString, LineString as OlLineString, Polygon } from 'ol/geom';
import OlDrawInteraction, { DrawEvent } from 'ol/interaction/Draw';
import {
	Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlLayerSwitcher from 'ol-layerswitcher';
import { getTransform } from 'ol/proj';
import { deepcopy, getMapCoordinate } from './Utilities';

import * as MissionFeatures from './shared/MissionFeatures'

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
	faRuler,
	faEdit,
	faLayerGroup,
	faWrench,
} from '@fortawesome/free-solid-svg-icons';


const jaiabot_icon = require('../icons/jaiabot.png')

import {BotDetailsComponent, HubDetailsComponent, DetailsExpandedState} from './Details'
import { jaiaAPI } from '../../common/JaiaAPI';

import tooltips from '../libs/tooltips'

// jQuery UI touch punch
import punchJQuery from '../libs/jquery.ui.touch-punch'

import { error, success, warning, info} from '../libs/notifications';

// Don't use any third party css exept reset-css!
import 'reset-css';
// import 'ol-layerswitcher/src/ol-layerswitcher.css';
import '../style/CommandControl.less';

const rallyPointRedIcon = require('../icons/rally-point-red.svg')
const rallyPointGreenIcon = require('../icons/rally-point-green.svg')
const missionOrientationIcon = require('../icons/compass.svg')
const goToRallyGreen = require('../icons/go-to-rally-point-green.png')
const goToRallyRed = require('../icons/go-to-rally-point-red.png')

import { LoadMissionPanel } from './LoadMissionPanel'
import { SaveMissionPanel } from './SaveMissionPanel'

import { gebcoLayer } from './ChartLayers';

import { BotListPanel } from './BotListPanel'
import { CommandList } from './Missions';
import { fromLonLat } from 'ol/proj.js';
import { Goal, HubStatus, BotStatus, TaskType, GeographicCoordinate, MissionPlan, CommandType, MissionStart, MovementType, Command, Engineering, MissionTask } from './shared/JAIAProtobuf'
import { MapBrowserEvent, MapEvent } from 'ol'
import { StyleFunction } from 'ol/style/Style'
import { EventsKey } from 'ol/events'
import { PodStatus } from './PortalStatus'
import * as Styles from './shared/Styles'
import { createBotFeature } from './shared/BotFeature'
import { createHubFeature } from './shared/HubFeature'

// Jaia imports
import { SurveyLines } from './SurveyLines'
import { SurveyPolygon } from './SurveyPolygon'
import { createMap } from './Map'
import { layers } from './Layers'

import { getGeographicCoordinate } from './Utilities'
import { playDisconnectReconnectSounds } from './DisconnectSound'
import { Interactions } from './Interactions'

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

const viewportDefaultPadding = 100;
const sidebarInitialWidth = 0;

const POLLING_INTERVAL_MS = 500;

const MAX_RUNS: number = 99;
const MAX_GOALS = 15;

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

export enum Mode {
	NONE = '',
	MISSION_PLANNING = 'missionPlanning',
	SET_RALLY_POINT_GREEN = "setRallyPointGreen",
	SET_RALLY_POINT_RED = "setRallyPointRed"
}

interface HubOrBot {
	type: 'hub' | 'bot',
	id: number
}

export interface RunInterface {
	id: string,
	name: string,
	assigned: number,
	editing: boolean,
	command: Command
}

export interface MissionInterface {
	id: string,
	name: string,
	runs: {[key: string]: RunInterface},
	runIdIncrement: number,
	botsAssignedToRuns: {[key: number]: string}
}

interface State {
	engineeringPanelActive: boolean,
	missionPanelActive: boolean,
	mode: Mode,
	currentInteraction: Interaction | null,
	selectedHubOrBot?: HubOrBot,
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
	missionPlanningGrid?: {[key: string]: number[][]},
	missionPlanningLines?: any,
	missionPlanningFeature?: OlFeature<Geometry>,
	missionBaseGoal: Goal,
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
	runList: MissionInterface,
	undoRunListStack: MissionInterface[],
	remoteControlInterval?: ReturnType<typeof setInterval>,
	remoteControlValues: Engineering

	center_line_string: turf.helpers.Feature<turf.helpers.LineString>

	podStatus: PodStatus
}

export default class CommandControl extends React.Component {

	props: Props
	state: State

	mapDivId = `map-${Math.round(Math.random() * 100000000)}`
	api = jaiaAPI
	flagNumber = 1
	surveyExclusionsStyle?: StyleFunction = null

	surveyLines: SurveyLines
	surveyPolygon: SurveyPolygon
	surveyExclusionsInteraction: OlDrawInteraction

	timerID: NodeJS.Timer

	oldPodStatus?: PodStatus

	missionEndTask: MissionTask = {type: TaskType.NONE}
	missionPlans?: CommandList = null

	interactions: Interactions

	constructor(props: Props) {
		super(props)

		this.state = {
			// User interaction modes
			mode: Mode.NONE,
			podStatus: {
				bots: {},
				hubs: {},
				controllingClientId: null
			},
			selectedHubOrBot: null,
			lastBotCount: 0,
			currentInteraction: null,
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
				'mission_type': 'lines',
				'num_bots': 4,
				// Account for start rally and end rally
				'num_goals': (MAX_GOALS - 2),
				'spacing': 30,
				'orientation': 0,
				'rally_spacing': 1,
				'sp_area': 0,
				'sp_perimeter': 0,
				'sp_rally_start_dist': 0,
				'sp_rally_finish_dist': 0,
				'selected_bots': [],
				'use_max_length': true
			},
			missionPlanningGrid: null,
			missionPlanningLines: null,
			missionPlanningFeature: null,
			missionBaseGoal: {},
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
				advancedCommands: false,
				health: false,
				data: false,
				gps: false,
				imu: false,
				sensor: false,
				power: false,
			},
			mapLayerActive: false, 
			engineeringPanelActive: false,
			missionPanelActive: false,
			runList: null,
			undoRunListStack: [],
			remoteControlInterval: null,
			remoteControlValues: {
				bot_id: -1,
				pid_control: {
					throttle: 0,
					rudder: 0,
					timeout: 2
				}
			},
			center_line_string: null
		};

		this.state.runList = {
			id: 'mission-1',
			name: 'Mission 1',
			runs: {},
			runIdIncrement: 0,
			botsAssignedToRuns: {}
		}

		map = createMap()

		this.interactions = new Interactions(this, map)

		map.addInteraction(this.interactions.pointerInteraction)
		map.addInteraction(this.interactions.translateInteraction)
		map.addInteraction(this.interactions.dragAndDropInteraction)

		// Set the map for the TaskData object, so it knows where to put popups, and where to get the projection transform
		taskData.map = map

		this.surveyLines = new SurveyLines(this)
		this.surveyPolygon = new SurveyPolygon(this)

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
			missionPlanningLines: null,
			center_line_string: null
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
			this.changeInteraction(this.surveyPolygon.drawInteraction, 'crosshair');
		if (this.state.missionParams.mission_type === 'editing')
			this.changeInteraction(this.interactions.selectInteraction, 'grab');
		if (this.state.missionParams.mission_type === 'lines')
			this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
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

	componentDidMount() {

		let test = "test"

		map.setTarget(this.mapDivId);

		const viewport = document.getElementById(this.mapDivId);
		map.getView().setMinZoom(Math.ceil(Math.LOG2E * Math.log(viewport.clientWidth / 256)));

		const us = this;


		this.timerID = setInterval(() => this.pollPodStatus(), 0);

		($('.panel > h2') as any).disableSelection();

		OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'), {});

		($('button') as any).disableSelection();

		tooltips();

		const mapLayersPanel = document.getElementById('mapLayers')
		mapLayersPanel.addEventListener('click', handleLayerSwitcherClick)
		mapLayersPanel.style.width = '0px'

		function handleLayerSwitcherClick(event: Event) {
			let targetElement = event.target as HTMLElement

			if (targetElement.tagName === 'LABEL' && targetElement.parentElement.classList.contains('layer-switcher-fold')) {
				event.preventDefault()
				const siblings = []
				while ((targetElement = targetElement.previousElementSibling as HTMLElement)) {
					siblings.push(targetElement)
				}
				siblings.forEach(sibling => {
					if (sibling.tagName === 'BUTTON') {
						sibling.click()
					}
				})
			} else if (targetElement.classList.contains('layer-switcher-fold')) {
				const children: HTMLElement[] = Array.prototype.slice.call(targetElement.children)
				children.forEach(child => {
					if (child.tagName === 'BUTTON') {
						child.click()
					}
				})
			}
		}

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
				hold_time: 0
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

		/* ////////////////////////////////////////////////////////////////////////// */

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
				this.surveyLines.listener = evt.feature.on('change', (evt2) => {
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

				layers.exclusionsLayer.setSource(vectorSource);
				layers.exclusionsLayer.setZIndex(5000);

				this.setState({
					surveyExclusions: turf.coordAll(turf.polygon(geometry.getCoordinates()))
				})
				OlUnobserveByKey(surveyExclusionslistener);
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

		// Update layers derived from the podStatus
		if (prevState.podStatus !== this.state.podStatus ||
			prevState.selectedHubOrBot !== this.state.selectedHubOrBot) {
			this.updateHubsLayer()
			this.updateBotsLayer()
			this.updateActiveMissionLayer()
			playDisconnectReconnectSounds(this.oldPodStatus, this.state.podStatus)
		}

		// If we select another bot, we need to re-render the mission layer to re-color the mission lines
		if (prevState.selectedHubOrBot !== this.state.selectedHubOrBot) {
			this.updateMissionLayer()
		}
	}

	componentWillUnmount() {
		clearInterval(this.timerID)
	}

	getLiveLayerFromHubId(hub_id: number) {
		const hubsLayerCollection = layers.hubsLayerCollection
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
		const botsLayerCollection = layers.botsLayerCollection

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

	// changeInteraction()
	//   Removes the currecntInteraction, and replaces it with newInteraction, changing the cursor to cursor
	//
	//   Inputs
	//     newInteraction:  the new interaction to use (for example the survey line selection interaction)
	//     cursor:  the name of the cursor to use for this interaction
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
		if (!isFinite(geom[0]) || !isFinite(geom[1]) || !isFinite(geom[2]) || !isFinite(geom[3])) {
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
		const { selectedHubOrBot } = this.state
		let hubs = this.state.podStatus.hubs;

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

			const coordinate = getMapCoordinate(hub.location, map)

			hubFeature.setGeometry(new OlPoint(coordinate));
			hubFeature.setProperties({
				heading: 0,
				speed: 0,
				hubId: hubId,
			});

			const zoomExtentWidth = 0.001; // Degrees

			const selected = selectedHubOrBot != null && selectedHubOrBot.type == "hub" && selectedHubOrBot.id == hub_id
			hubFeature.set('selected', selected);

			hubLayer.getSource().clear();
			hubLayer.getSource().addFeature(hubFeature);

			hubLayer.setZIndex(100);
			hubLayer.changed();
		} // end foreach hub
	}

	updateActiveMissionLayer() {
		const bots = this.state.podStatus.bots
		let allFeatures = []

		for (let botId in bots) {
			let bot = bots[botId]

			const active_mission_plan = bot.active_mission_plan
			if (active_mission_plan != null) {
				let features = MissionFeatures.createMissionFeatures(map, Number(botId), active_mission_plan, bot.active_goal, this.isBotSelected(Number(botId)))
				allFeatures.push(...features)
			}
		}

		let source = layers.activeMissionLayer.getSource()
		source.clear()
		source.addFeatures(allFeatures)
	}

	updateBotsLayer() {
		const { selectedHubOrBot } = this.state
		let bots = this.state.podStatus.bots

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

			const coordinate = getMapCoordinate(bot.location, map)

			const botFeature = createBotFeature({
				map: map,
				botId: Number(botId),
				lonLat: [botLongitude, botLatitude],
				heading: botHeading,
				courseOverGround: bot.attitude?.course_over_ground
			})

			botFeature.setId(bot_id);


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

			const isSelected = selectedHubOrBot != null && selectedHubOrBot.type == "bot" && selectedHubOrBot.id == bot_id
			botFeature.set('selected', isSelected)

			botFeature.set('controlled', false);
			botFeature.set('tracked', false);
			botFeature.set('completed', false);

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
			lastBotCount: botCount
		});
	}

	// POLL THE BOTS
	pollPodStatus() {
		clearInterval(this.timerID);
		const us = this

		function hubConnectionError(errorMessage: String) {
			us.setState({disconnectionMessage: "Connection Dropped To HUB"})
			console.error(errorMessage)
			us.timerID = setInterval(() => us.pollPodStatus(), 2500)
		}

		this.api.getStatus().then(
			(result) => {
				console.log("Got response")
				if (result instanceof Error) {
					hubConnectionError(result.message)
					return
				}

				if (!("bots" in result)) {
					hubConnectionError(String(result))
					return
				}

				this.oldPodStatus = this.state.podStatus
				this.setState({podStatus: result})

				let messages = result.messages

				if (messages) {
					if (messages.info) {
						info(messages.info)
					}

					if (messages.warning) {
						warning(messages.warning)
					}

					if (messages.error) {
						this.setState({disconnectionMessage: messages.error})
					}
					else {
						this.setState({disconnectionMessage: null})
					}
				}

				if (this.state.mode !== Mode.MISSION_PLANNING) {
					this.updateMissionLayer()
				}

				this.timerID = setInterval(() => this.pollPodStatus(), POLLING_INTERVAL_MS);
			},
			(err) => {
				console.log("error response")
				hubConnectionError(err.message)
			}
		)
	}

	disconnectPod() {
		// This should always work because we're single threaded, right?
		clearInterval(this.timerID);
	}

	zoomToAllBots(firstMove = false) {
		if (layers.botsLayerGroup.getLayers().getLength() <= 0) {
			return;
		}
		const extent = OlCreateEmptyExtent();
		let layerCount = 0;
		layers.botsLayerGroup.getLayers().forEach((layer: OlVectorLayer<OlVectorSource>) => {
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
		layers.botsLayerGroup.getLayers().forEach(addExtent);
		if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
	}

	toggleBot(bot_id: number) {
		if (this.isBotSelected(bot_id)) {
			this.unselectHubOrBot()
		}
		else {
			this.selectBot(bot_id)
		}
	}

	toggleHub(id: number) {
		if (this.isHubSelected(id)) {
			this.unselectHubOrBot()
		}
		else {
			this.selectHub(id)
		}
	}

	selectBot(id: number) {
		// Clear remote control interval if there is one
		this.clearRemoteControlInterval();
		const hubOrBot = {type: "bot", id: id}
		this.setState({selectedHubOrBot: hubOrBot, detailsBoxItem: hubOrBot})
	}

	selectHub(id: number) {
		// Clear remote control interval if there is one
		this.clearRemoteControlInterval();
		const hubOrBot = {type: "hub", id: id}
		this.setState({selectedHubOrBot: hubOrBot, detailsBoxItem: hubOrBot})
	}

	unselectHubOrBot() {
		this.setState({selectedHubOrBot: null, detailsBoxItem: null})
	}

	isBotSelected(bot_id: number) {
		const { selectedHubOrBot } = this.state
		return selectedHubOrBot != null && selectedHubOrBot.type == "bot" && selectedHubOrBot.id == bot_id
	}

	isHubSelected(hub_id: number) {
		const { selectedHubOrBot } = this.state
		return selectedHubOrBot != null && selectedHubOrBot.type == "hub" && selectedHubOrBot.id == hub_id
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

	changeMissions(func: (runList: MissionInterface) => void, previousRunList: MissionInterface) {
		// Save a backup of the current mission set
		let oldMissions = deepcopy(this.state.runList)
		//console.log(this.state.runList);

		if(previousRunList != null
			|| previousRunList != undefined)
		{
			oldMissions = deepcopy(previousRunList);
		}

		// Do any alterations to the mission set
		func(this.state.runList)

		// If something was changed
		if (JSON.stringify(oldMissions) != JSON.stringify(this.state.runList) ) {
			// then place the old mission set into the undoMissions
			this.state.undoRunListStack.push(deepcopy(oldMissions))

			// Update the mission layer to reflect changes that were made
			this.updateMissionLayer()
		}
	}

	restoreUndo() {
		if (!confirm('Click the OK button to undo the previous run edit that was made:')) return

		if (this.state.undoRunListStack.length >= 1) {
			this.state.runList = this.state.undoRunListStack.pop()
			this.setState({goalBeingEdited: null})
			this.updateMissionLayer()
		} 
		else
		{
			info("There is no goal or task to undo!");
		}
	}

	sendStop() {
		if (!this.takeControl() || !confirm('Click the OK button to stop all missions:')) return

		this.api.allStop().then(response => {
			if (response.message) {
				error(response.message)
			}
			else {
				info("Sent STOP")
			}
		})
	}

	static formatLength(line: Geometry) {
		const length = OlGetLength(line, { projection: mercator });
		if (length > 100) {
			return `${Math.round((length / 1000) * 100) / 100} km`;
		}
		return `${Math.round(length * 100) / 100} m`;
	}

	weAreInControl() {
		const {controllingClientId} = this.state.podStatus
		return (controllingClientId == this.api.clientId) || controllingClientId == null
	}

	takeControl() {
		// Clear interval for remote control if there is one
		this.clearRemoteControlInterval();

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
			engineeringPanelActive,
			missionPanelActive,
			goalBeingEdited,
			goalBeingEditedBotId,
			goalBeingEditedGoalIndex
		} = this.state;
		
		// Are we currently in control of the bots?
		const containerClasses = this.weAreInControl() ? 'controlling' : 'noncontrolling'

		let self: CommandControl = this

		let bots = this.state.podStatus?.bots
		let hubs = this.state.podStatus?.hubs

		let goalSettingsPanel: ReactElement = null

		if (goalBeingEdited != null) {
			goalSettingsPanel = 
				<GoalSettingsPanel 
					map={map}
					key={`${goalBeingEditedBotId}-${goalBeingEditedGoalIndex}`}
					botId={goalBeingEditedBotId}
					goalIndex={goalBeingEditedGoalIndex}
					goal={goalBeingEdited} 
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
				map={map}
				mission_params={this.state.missionParams}
				center_line_string={this.state.center_line_string}
				bot_list={bots}
				missionBaseGoal={this.state.missionBaseGoal}
				missionEndTask={this.missionEndTask}
				onClose={() => {
					this.clearMissionPlanningState()
				}}
				onMissionChangeEditMode={() => {
					this.changeMissionMode()
				}}
				onTaskTypeChange={() => {
					this.missionPlans = null
					this.updateMissionLayer()
				}}
				onMissionApply={(missionSettings: MissionSettings) => {
					this.missionEndTask = missionSettings.endTask

					if (this.state.missionParams.mission_type === 'lines') {
						this.updateMissionPlansFromMissionPlanningGrid()

						this.deleteAllRunsInMission(this.state.runList);

						for(let id in this.missionPlans)
						{
							Missions.addRunWithGoals(this.missionPlans[id].bot_id, this.missionPlans[id].plan.goal, this.state.runList);
						}

						// Close panel after applying
						this.changeInteraction();
						this.setState({
							surveyPolygonActive: false,
							mode: '',
							surveyPolygonChanged: false,
							missionPlanningGrid: null,
							missionPlanningLines: null,
							goalBeingEdited: null,
							center_line_string: null
						});

						this.updateMissionLayer();
					} else {
						// Polygon
						this.genMission()
					}
				}}
				onMissionChangeBotList={() => {
					this.changeMissionBotList()
				}}
				areBotsAssignedToRuns={() => this.areBotsAssignedToRuns()}
				/>
		}

		// Details box
		let detailsBoxItem = this.state.detailsBoxItem
		var detailsBox = null

		function closeDetails() {
			self.setState({detailsBoxItem: null})
		}

		switch (detailsBoxItem?.type) {
			case 'hub':
				detailsBox = HubDetailsComponent(hubs?.[this.selectedHubId()], 
												this.api, 
												closeDetails, 
												this.state.detailsExpanded,
												this.takeControl.bind(this),
												this.detailsDefaultExpanded.bind(this));
				
				break;
			case 'bot':
				//**********************
				// TO DO  
				// the following line assumes fleets to only have hub0 in use
				//**********************
				detailsBox = BotDetailsComponent(bots?.[this.selectedBotId()], 
												hubs?.[0], 
												this.api, 
												this.state.runList, 
												closeDetails,
												this.takeControl.bind(this),
												this.state.detailsExpanded,
												this.createRemoteControlInterval.bind(this),
												this.clearRemoteControlInterval.bind(this),
												this.state.remoteControlValues,
												this.weAreInControl.bind(this),
												this.weHaveRemoteControlInterval.bind(this),
												this.deleteSingleRun.bind(this),
												this.detailsDefaultExpanded.bind(this));
				break;
			default:
				detailsBox = null;
				
				// Clear remote control interval if there is one
				this.clearRemoteControlInterval();
				break;
		}

		function closeMissionPanel() {
			let missionPanel = document.getElementById('missionPanel')
			missionPanel.style.width = "0px"
			self.setState({missionPanelActive: false})
		}

		function closeEngineeringPanel() {
			let engineeringPanel = document.getElementById('engineeringPanel')
			engineeringPanel.style.width = "0px"
			self.setState({engineeringPanelActive: false})
		}

		function closeMissionSettingsPanel() {
			self.changeInteraction();
			self.setState({
				surveyPolygonActive: false,
				mode: '',
				surveyPolygonChanged: false,
				missionPlanningGrid: null,
				missionPlanningLines: null
			});
			self.updateMissionLayer();
		}

		function closeMapLayers() {
			let mapLayersPanel = document.getElementById('mapLayers')
			mapLayersPanel.style.width = '0px'
			self.setState({mapLayerActive: false});
		}

		function closeOtherViewControlWindows(openPanel: string) {
			const panels = [
				{ name: 'missionPanel', closeFunction: closeMissionPanel },
				{ name: 'engineeringPanel', closeFunction: closeEngineeringPanel },
				{ name: 'missionSettingsPanel', closeFunction: closeMissionSettingsPanel },
				{ name: 'measureTool', closeFunction: () => self.setState({ measureActive: false })},
				{ name: 'mapLayersPanel', closeFunction: closeMapLayers }
			]

			panels.forEach(panel => {
				if (openPanel !== panel.name) {
					panel.closeFunction()
				}
			})
		}

		return (
			<div id="axui_container" className={containerClasses}>

				<EngineeringPanel api={this.api} bots={bots} hubs={hubs} getSelectedBotId={this.selectedBotId.bind(this)} control={this.takeControl.bind(this)} />

				<MissionControllerPanel 
					api={this.api} 
					bots={bots} 
					mission={this.state.runList} 
					loadMissionClick={this.loadMissionButtonClicked.bind(this)}
					saveMissionClick={this.saveMissionButtonClicked.bind(this)}
					deleteAllRunsInMission={this.deleteAllRunsInMission.bind(this)}
					autoAssignBotsToRuns={this.autoAssignBotsToRuns.bind(this)}
				/>
				
				<div id={this.mapDivId} className="map-control" />

				<div id="mapLayers" />

				<div id="layerinfo">&nbsp;</div>

				<div id="viewControls">

					{mapLayerActive ? (
						<Button className="button-jcc active"
							onClick={() => {
								this.setState({mapLayerActive: false}); 
								const mapLayers = document.getElementById('mapLayers')
								mapLayers.style.width = '0px'
								const mapLayersBtn = document.getElementById('mapLayersButton')
							}}
						>
							<FontAwesomeIcon icon={faLayerGroup as any} title="Map Layers" />
						</Button>

					) : (
						<Button className="button-jcc"
							onClick={() => {
								closeOtherViewControlWindows('mapLayersPanel');
								this.setState({mapLayerActive: true}); 
								const mapLayers = document.getElementById('mapLayers')
								mapLayers.style.width = '400px'
								const mapLayersBtn = document.getElementById('mapLayersButton')
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
								closeOtherViewControlWindows('measureTool')
								this.setState({ measureActive: true });
								this.changeInteraction(this.interactions.measureInteraction, 'crosshair');
								info('Touch map to set first measure point');
							}}
						>
							<FontAwesomeIcon icon={faRuler as any} title="Measure Distance"/>
						</Button>
					)}
					{/*trackingTarget === 'all' ? (
						<Button 
							onClick={() => {
								this.zoomToAll(false);
								this.trackBot(null);
							}}
							className="button-jcc active"
						>
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
					)*/}
					{trackingTarget === 'pod' ? (
						<Button 							
							onClick={() => {
								this.zoomToAllBots(false);
								this.trackBot(null);
							}} 
							className="button-jcc active"
						>
							<FontAwesomeIcon icon={faMapMarkerAlt as any} title="Unfollow Bots" />
						</Button>
					) : (
						<Button
							className="button-jcc"
							onClick={() => {
								this.zoomToAllBots(true);
								this.trackBot('pod');
							}}
						>
							<FontAwesomeIcon icon={faMapMarkerAlt as any} title="Follow Bots" />
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
								if (this.state.rallyPointRedLocation
										&& this.state.rallyPointGreenLocation) {
									closeOtherViewControlWindows('missionSettingsPanel');
									this.setState({ surveyPolygonActive: true, mode: Mode.MISSION_PLANNING });
									if (this.state.missionParams.mission_type === 'polygon-grid')
										this.changeInteraction(this.surveyPolygon.drawInteraction, 'crosshair');
									if (this.state.missionParams.mission_type === 'editing')
										this.changeInteraction(this.interactions.selectInteraction, 'grab');
									if (this.state.missionParams.mission_type === 'lines')
										this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
									if (this.state.missionParams.mission_type === 'exclusions')
										this.changeInteraction(this.surveyExclusionsInteraction, 'crosshair');

									this.setState({center_line_string: null}) // Forgive me

									info('Touch map to set first polygon point');
								} 
								else
								{
									info('Please place a green and red rally point before using this tool');
								}
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
							closeOtherViewControlWindows('engineeringPanel');
							this.setState({engineeringPanelActive: true});
							this.toggleEngineeringPanel();
						}} 
						>
							<FontAwesomeIcon icon={faWrench as any} title="Engineering Panel" />
						</Button>
					)}

					{missionPanelActive ? (
						<Button className="button-jcc active" onClick={() => {
								this.setState({missionPanelActive: false}); 
								this.toggleMissionPanel();
							}} 
						>
							<Icon path={mdiViewList} title="Mission Panel"/>
						</Button>

					) : (
						<Button className="button-jcc" onClick={() => {
							closeOtherViewControlWindows('missionPanel');
							this.setState({missionPanelActive: true}); 
							this.toggleMissionPanel();
						}} 
						>
							<Icon path={mdiViewList} title="Mission Panel"/>
						</Button>
					)}

					<img className="jaia-logo button" src="/favicon.png" onClick={() => { 
						alert("Jaia Robotics\nAddress: 22 Burnside St\nBristol\nRI 02809\nPhone: P: +1 401 214 9232\n"
							+ "Comnpany Website: https://www.jaia.tech/\nDocumentation: http://52.36.157.57/index.html\n") 
						}}>	
					</img>

				</div>

				<div id="botsDrawer">
					<BotListPanel podStatus={this.state.podStatus} 
						selectedBotId={this.selectedBotId()}
						selectedHubId={this.selectedHubId()}
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

    autoAssignBotsToRuns() {
        let podStatusBotIds = Object.keys(this.state.podStatus?.bots);
        let botsAssignedToRunsIds = Object.keys(this.state.runList.botsAssignedToRuns);
        let botsNotAssigned: number[] = [];

		// Find the difference between the current botIds available
        // And the bots that are already assigned to get the ones that
        // Have not been assigned yet
        podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key)) {
                let id = Number(key);
                if(isFinite(id))
                {
                    botsNotAssigned.push(id);
                }
            }
        });

        botsNotAssigned.forEach((assigned_key) => {
            for (let run_key in this.state.runList.runs) {
                if (this.state.runList.runs[run_key].assigned == -1) {
                    // Delete assignment
                    delete this.state.runList.botsAssignedToRuns[this.state.runList.runs[run_key].assigned];

                    this.state.runList.runs[run_key].assigned = Number(assigned_key); 
                    this.state.runList.runs[run_key].command.bot_id = Number(assigned_key); 
                    this.state.runList.botsAssignedToRuns[this.state.runList.runs[run_key].assigned] = this.state.runList.runs[run_key].id

                    this.setState({runList: this.state.runList})
                    break;
                }
            }
        })
    }

    detailsDefaultExpanded(accordian: keyof DetailsExpandedState) {
		let detailsExpanded = this.state.detailsExpanded;

		const newDetailsExpanded = this.state.detailsExpanded;
		
		if(detailsExpanded[accordian])
		{
			newDetailsExpanded[accordian] = false;
		} else
		{
			newDetailsExpanded[accordian] = true;
		}

		this.setState({ detailsExpanded:newDetailsExpanded });
	}

	createRemoteControlInterval() {
		// Before creating a new interval, clear the current one
		this.clearRemoteControlInterval();

		this.state.remoteControlInterval = 
			setInterval(() => {
				console.log(this.state.remoteControlValues.pid_control);
				this.api.postEngineeringPanel(this.state.remoteControlValues);
			}, 100)
	}

	clearRemoteControlInterval() {
		if(this.state.remoteControlInterval)
		{
			clearInterval(this.state.remoteControlInterval);
			this.state.remoteControlInterval = null;
		}
	}

	weHaveRemoteControlInterval() {
		if(this.state.remoteControlInterval)
		{
			return true;
		} else
		{
			return false;
		}
	}

	didClickBot(bot_id: number) {
		this.toggleBot(bot_id)
	}

	didClickHub(hub_id: number) {
		this.toggleHub(hub_id)
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

	addWaypointAtCoordinate(coordinate: number[]) {
		this.addWaypointAt(getGeographicCoordinate(coordinate, map))
	}

	addWaypointAt(location: GeographicCoordinate) {
		let botId = this.selectedBotId()

		if (botId == null) {
			return
		}

		this.changeMissions((missions) => {
			let runs = missions?.runs;
			let botsAssignedToRuns = missions?.botsAssignedToRuns;

			if(!(botId in botsAssignedToRuns))
			{
				missions = Missions.addRunWithWaypoints(botId, [], this.state.runList);
			}

			// Attempted to create a run greater than MAX_RUNS
			// The check for MAX_RUNS occurs in Missions.tsx
			if (!missions) { return }

			if(runs[botsAssignedToRuns[botId]]?.command == null)
			{
				runs[botsAssignedToRuns[botId]].command = Missions.commandWithWaypoints(botId, []);
			}

			let runCommand = runs[botsAssignedToRuns[botId]].command;

			if(runCommand.plan.goal.length < MAX_GOALS)
			{
				runCommand.plan.goal.push({location: location})	
			}
			else
			{
				warning("Adding this goal exceeds the limit of "+ MAX_GOALS +"!");
			}
		}, null)

	}

	surveyStyle(self: CommandControl, feature: OlFeature<Geometry>, taskType: TaskType) {
			// console.log('WHAT IS GOING ON!!!!');
			// console.log(feature);
			// console.log(self.state);
			// console.log(self.homeLocation);

		let iStyle = Styles.goalIcon(taskType, false, false)

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
		let features = new OlCollection<OlFeature>([], {unique:true})

		let selectedFeatures = [];

		let missions = this.state.runList

		let selectedColor = '#34d2eb'
		let unselectedColor = 'white'
		let surveyPolygonColor = '#051d61'
		let surveyExclusionsColor = '#c40a0a'

		let zIndex = 2

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

		if (this.state.missionPlanningGrid) {
			this.updateMissionPlansFromMissionPlanningGrid()
			features = features.extend(this.featuresFromMissionPlanningGrid())
		}

		for (let key in missions?.runs) {
			// Different style for the waypoint marker, depending on if the associated bot is selected or not
			let lineStyle
			let run = missions?.runs[key];
			let assignedBot = run.assigned
			let selected = this.isBotSelected(assignedBot)
			let active_goal_index = this.state.podStatus?.bots?.[assignedBot]?.active_goal;

			// Add our goals
			const plan = run.command?.plan
			if (plan != null) {
				// Checks for run-x, run-xx, and run-xxx; Works for runs ranging from 1 to 999
				const runNumber = run.id.length === 5 ? run.id.slice(-1) : (run.id.length === 7 ? run.id.slice(-3) : run.id.slice(-2))
				const missionFeatures = MissionFeatures.createMissionFeatures(map, assignedBot, plan, active_goal_index, selected, runNumber, zIndex)
				features.extend(missionFeatures)
				if (selected) {
					selectedFeatures.push(...missionFeatures);
				}
				zIndex += 1
			}
		}

		// Add Home, if available
		if (this.state.rallyPointRedLocation) {
			let pt = getMapCoordinate(this.state.rallyPointRedLocation, map)
			let rallyPointRedFeature = new OlFeature({ geometry: new OlPoint(pt) })
			rallyPointRedFeature.setStyle(rallyPointRedStyle)
			features.push(rallyPointRedFeature)
		}

		if (this.state.rallyPointGreenLocation) {
			let pt = getMapCoordinate(this.state.rallyPointGreenLocation, map)
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
				layers.missionPlanningLayer.setSource(missionPlanningSource);
				layers.missionPlanningLayer.setZIndex(2000);
			}
		}

		var vectorSource: OlVectorSource
		try {
			vectorSource = new OlVectorSource({
				features: features
			})
		}
		catch (error) {
			debugger;
		}

		let vectorSelectedSource = new OlVectorSource({
			features: selectedFeatures as any
		})


		layers.missionLayer.setSource(vectorSource)
		layers.missionLayer.setZIndex(1000)

		layers.selectedMissionLayer.setSource(vectorSelectedSource)
		layers.selectedMissionLayer.setZIndex(1001)
	}

	// This function returns a set of features illustrating the missionPlanningGrid
	//
	//   Input:
	//     this.state.missionPlanningGrid
	//     this.state.missionBaseGoal
	//   Return value:
	//     A list of features
	featuresFromMissionPlanningGrid() {
		var features: OlFeature<Geometry>[] = []

		let mpg = this.state.missionPlanningGrid;
		let mpgKeys = Object.keys(mpg);

		mpgKeys.forEach(key => {
			const bot_id = Number(key)

			let mpGridFeature = new OlFeature(
				{
					geometry: new OlMultiPoint(mpg[key]),
					style: new OlStyle({
						image: Styles.goalIcon(this.state.missionBaseGoal.task.type, false, false)
					})
				}
			)
			mpGridFeature.setProperties({'botId': key});
			mpGridFeature.setStyle(new OlStyle({
				image: Styles.goalIcon(this.state.missionBaseGoal.task.type, false, false)
			}))

			features.push(mpGridFeature);
		})

		return features
	}

	// This incredibly messy function takes in mission parameters, and generates this.state.missionPlans, 
	//    which is used by updateMissionLayer to generate the OpenLayers features representing the current mission plans
	//
	//    Input:
	//      this.state.podStatus.bots
	//      this.state.rallyPointGreenLocation
	//      this.state.rallyPointRedLocation
	//      this.state.missionParams
	//      this.state.missionPlanningGrid
	//    Return value:
	//      MissionPlans
	updateMissionPlansFromMissionPlanningGrid() {
		let missionPlans: CommandList = {};
		let millisecondsSinceEpoch = new Date().getTime();
		let bot_list = Object.keys(this.state.podStatus.bots).map((value: string) => { return Number(value) })

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
			const bot_id = Number(key)

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
			const bot_mission_goal_positions: turf.helpers.Position[] = mpg[key]

			bot_mission_goal_positions.forEach((goal: turf.helpers.Position, index: number) => {
				let goalWgs84 = turf.coordAll(turf.toWgs84(turf.point(goal)))[0]

				// For each bot's final goal, we use the missionEndTask, (like a Constant Heading task)
				const is_last_goal = index == bot_mission_goal_positions.length - 1
				const task = is_last_goal ? this.missionEndTask : this.state.missionBaseGoal.task

				bot_goal = {
					"location": {
						"lat": goalWgs84[1],
						"lon": goalWgs84[0]
					},
					"task": task
				}
				bot_goals.push(bot_goal);
			})

			// Home Goals
			bot_goal = {
				"location": {
					"lat": rallyFinishPoints[key][1],
					"lon": rallyFinishPoints[key][0]
				},
				"task": {
					type: TaskType.STATION_KEEP
				}
			}
			bot_goals.push(bot_goal)

			let mission_dict: Command = {
				bot_id: Number(key),
				time: millisecondsSinceEpoch,
				type: CommandType.MISSION_PLAN,
				plan: {
					start: MissionStart.START_IMMEDIATELY,
					movement: MovementType.TRANSIT,
					goal: bot_goals,
					recovery: {
						recover_at_final_goal: true
					}
				}
			}
			missionPlans[bot_id] = mission_dict;
		})

		this.missionPlans = missionPlans
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
	runMissions(missions: MissionInterface, add_runs: CommandList) {
		if (!this.takeControl()) return

		let botIds: number[] = [];
		let botIdsInIdleState: number[] = [];

		let runs = missions.runs;

		Object.keys(runs).map(key => {
			let botIndex = runs[key].assigned;
			if(botIndex != -1)
			{
				let botState = this.state.podStatus.bots[botIndex]?.mission_state;
				if(botState == "PRE_DEPLOYMENT__IDLE"
					|| botState == "POST_DEPLOYMENT__IDLE")
				{
					botIdsInIdleState.push(botIndex);
				}
				else
				{
					botIds.push(botIndex);
				}
			}
		})

		botIds.sort()
		botIdsInIdleState.sort();

		if(botIdsInIdleState.length != 0)
		{
			warning("Please activate bots: " + botIdsInIdleState);
		} 
		else
		{
			if (confirm("Click the OK button to run this mission for bots: " + botIds)) {
				if(add_runs)
				{
					this.deleteAllRunsInMission(missions);
					Object.keys(add_runs).map(key => {
						Missions.addRunWithCommand(Number(key), add_runs[Number(key)], missions);
					});
				}

				Object.keys(runs).map(key => {
					let botIndex = runs[key].assigned;
					if(botIndex != -1)
					{
						let runCommand = runs[key].command;
						this._runMission(runCommand)
					}
				})
				success("Submitted missions")
				this.updateMissionLayer()
			}
		}
	}

	// Loads the set of runs, and updates the GUI
	loadMissions(mission: MissionInterface) {
		this.deleteAllRunsInMission(this.state.runList);
		for(let run in mission.runs)
		{
			Missions.addRunWithCommand(-1, mission.runs[run].command, this.state.runList);
		}

		this.updateMissionLayer()
	}

	// Check if a run is assigned to any bot
	areBotsAssignedToRuns() {
		const botsAssignedToRuns = this.state.runList.botsAssignedToRuns
		if (Object.keys(botsAssignedToRuns).length === 0) {
			return false
		}
		return true
	}

	deleteAllRunsInMission(mission: MissionInterface) {
		
		for(let run in mission.runs)
		{
			delete mission.runs[run];
		}

		for(let botId in mission.botsAssignedToRuns)
		{
			delete mission.botsAssignedToRuns[botId]
		}

		mission.runIdIncrement = 0;
	}

	deleteSingleRun() {
		const runList = this.state.runList
		const selectedBotId = this.selectedBotId()
		const runId = runList.botsAssignedToRuns[selectedBotId] ? runList.botsAssignedToRuns[selectedBotId] : -1
		const warning_string = "Are you sure you want to delete run for bot: " + selectedBotId;

		if (confirm(warning_string)) {
			// No missions assigned to selected bot, exit function to prevent runtime error
			if (runId === -1) {
				return 
			}

			const run = runList.runs[runId]

			delete runList?.runs[runId]
			delete runList?.botsAssignedToRuns[run.assigned]
		}
	}

	// Currently selected botId
	selectedBotId() {
		const { selectedHubOrBot } = this.state
		if (selectedHubOrBot == null || selectedHubOrBot.type != "bot") return null
		else {
			return selectedHubOrBot.id
		}
	}

	selectedHubId() {
		const { selectedHubOrBot } = this.state
		if (selectedHubOrBot == null || selectedHubOrBot.type != "hub") return null
		else {
			return selectedHubOrBot.id
		}
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
				previous_mission_history = deepcopy(this.state.runList);
				this.setState({
					goalBeingEdited: goal, 
					goalBeingEditedBotId: botId, 
					goalBeingEditedGoalIndex: goalIndex
				})
				return false
			}

			// Clicked on a bot
			const bot_id = feature.get('botId')
			if (bot_id != null) {
				this.toggleBot(bot_id)
			}

			// Clicked on the hub
			const hub_id = feature.get('hubId')
			if (hub_id != null) {
				this.toggleHub(hub_id)
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

	placeRallyPointGreenAtCoordinate(coordinate: number[]) {
		this.setState({
			rallyPointGreenLocation: getGeographicCoordinate(coordinate, map),
			mode: ''
		}, () => {
			this.updateMissionLayer()
		})

		this.toggleMode(Mode.SET_RALLY_POINT_GREEN)
	}

	placeRallyPointRedAtCoordinate(coordinate: number[]) {
		this.setState({
			rallyPointRedLocation: getGeographicCoordinate(coordinate, map),
			mode: ''
		}, () => {
			this.updateMissionLayer()
		})

		this.toggleMode(Mode.SET_RALLY_POINT_RED)
	}

	stopDown(arg: boolean) {
		return false
	}

	generateMissions() {
		if (!this.takeControl()) return;

		let bot_list = [];
		for (const bot in this.state.podStatus.bots) {
			bot_list.push(this.state.podStatus.bots[bot]['bot_id'])
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
				{/*<Button id= "all-next-task" className="button-jcc" onClick={this.nextTaskAllClicked.bind(this)}>
					<Icon path={mdiSkipNext} title="All Next Task"/>
				</Button>*/}
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
		}} areBotsAssignedToRuns={() => this.areBotsAssignedToRuns()}
		></LoadMissionPanel>

		this.setState({loadMissionPanel: panel, saveMissionPanel: null})
	}

	saveMissionButtonClicked() {
		let panel = <SaveMissionPanel missionLibrary={MissionLibraryLocalStorage.shared()} mission={this.state.runList} onDone={() => {
			this.setState({saveMissionPanel: null})
		}}></SaveMissionPanel>

		this.setState({saveMissionPanel: panel, loadMissionPanel: null})
	}

	undoButton() {
		return (<Button className={"globalCommand" + " button-jcc"} onClick={this.restoreUndo.bind(this)}><Icon path={mdiArrowULeftTop} title="Undo"/></Button>)
	}

	setRallyPointRedClicked(evt: Event) {
		this.toggleMode(Mode.SET_RALLY_POINT_RED)
	}

	setRallyPointGreenClicked(evt: Event) {
		this.toggleMode(Mode.SET_RALLY_POINT_GREEN)
	}

	goToRallyGreen(evt: UIEvent) {
		let add_runs: CommandList = {}

		if (!this.state.rallyPointGreenLocation) {
			alert('No green rally point selected.  Click on the map to select a green rally location and try again.')
			return
		}

		if (this.areBotsAssignedToRuns() && !confirm('Going to the green rally point will delete all runs in the mission. If the current mission is saved, select OK')) {
			return
		}

		for(let bot in this.state.podStatus.bots)
		{
			add_runs[Number(bot)] = Missions.commandWithWaypoints(Number(bot), [this.state.rallyPointGreenLocation]);
		}

		this.runMissions(this.state.runList, add_runs)
	}

	goToRallyRed(evt: UIEvent) {
		let add_runs: CommandList = {}

		if (!this.state.rallyPointRedLocation) {
			alert('No red rally point selected.  Click on the map to select a red rally location and try again.')
			return
		}

		if (this.areBotsAssignedToRuns() && !confirm('Going to the red rally point will delete all runs in the mission. If the current mission is saved, select OK')) {
			return
		}

		for(let bot in this.state.podStatus.bots)
		{
			add_runs[Number(bot)] = Missions.commandWithWaypoints(Number(bot), [this.state.rallyPointRedLocation]);
		}

		this.runMissions(this.state.runList, add_runs)
	}

	playClicked(evt: UIEvent) {
		this.runMissions(this.state.runList, null);
	}
	
	activateAllClicked(evt: UIEvent) {
		if (!this.takeControl() || !confirm('Click the OK button to run a system check for all active bots:')) return;

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
		if (!this.takeControl() || !confirm('Click the OK button to run the next task for all active bots:')) return;

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
		if (!this.takeControl() || !confirm('Click the OK button to recover all active bots:')) return

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

		var datum_location = this.state.podStatus?.bots?.[botId]?.location 

		if (datum_location == null) {
			const warning_string = 'RC mode issued, but bot has no location.  Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

			if (!confirm(warning_string)) {
				return
			}

			datum_location = {lat: 0, lon: 0}
		}

		//this.runMissions(Missions.RCMode(botId, datum_location), null)
	}

	sendFlag(evt: UIEvent) {
		if (!this.takeControl()) return

		// Send a user flag, to get recorded in the bot's logs
		const botId = this.selectedBotId() || 0
		let engineeringCommand: Engineering = {
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

	toggleMissionPanel() {
		let missionPanel = document.getElementById('missionPanel')
		if (missionPanel.style.width == "400px") {
			missionPanel.style.width = "0px"
		}
		else {
			missionPanel.style.width = "400px"
		}
	}

}

// =================================================================================================

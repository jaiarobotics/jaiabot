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
import RCControllerPanel from './RCControllerPanel'
import { taskData } from './TaskPackets'
import { getSurveyMissionPlans, featuresFromMissionPlanningGrid, surveyStyle } from './SurveyMission'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiPlay, 
	mdiLanDisconnect, mdiCheckboxMarkedCirclePlusOutline, 
	mdiFlagVariantPlus, mdiArrowULeftTop,
    mdiStop, mdiViewList} from '@mdi/js'

import Button from '@mui/material/Button';

// TurfJS
import * as turf from '@turf/turf';

// Openlayers
import OlMap from 'ol/Map';
import {
	Interaction,
} from 'ol/interaction';
import OlCollection from 'ol/Collection';
import OlPoint from 'ol/geom/Point';
import OlMultiLineString from 'ol/geom/MultiLineString';
import OlFeature from 'ol/Feature';
import { Coordinate } from 'ol/coordinate';
import { getLength as OlGetLength } from 'ol/sphere';
import { Geometry, LineString, MultiLineString, LineString as OlLineString, Polygon } from 'ol/geom';
import {
	Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlLayerSwitcher from 'ol-layerswitcher';
import { deepcopy, equalValues, getMapCoordinate } from './Utilities';
import { HubOrBot } from './HubOrBot'

import * as MissionFeatures from './shared/MissionFeatures'

import $ from 'jquery';
import 'jquery-ui/ui/widgets/resizable';
import 'jquery-ui/ui/widgets/slider';
import 'jquery-ui/ui/widgets/sortable';
import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/effects/effect-blind';
// jQuery UI touch punch
import punchJQuery from '../libs/jquery.ui.touch-punch'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faMapMarkerAlt,
	faRuler,
	faEdit,
	faLayerGroup,
	faWrench,
} from '@fortawesome/free-solid-svg-icons';

const jaiabot_icon = require('../icons/jaiabot.png')

import {BotDetailsComponent, HubDetailsComponent, DetailsExpandedState, BotDetailsProps, HubDetailsProps} from './Details'

import { jaiaAPI } from '../../common/JaiaAPI';

import { error, success, warning, info} from '../libs/notifications';

// Don't use any third party css exept reset-css!
import 'reset-css';
import '../style/CommandControl.less';

const rallyPointRedIcon = require('../icons/rally-point-red.svg')
const rallyPointGreenIcon = require('../icons/rally-point-green.svg')
const goToRallyGreen = require('../icons/go-to-rally-point-green.png')
const goToRallyRed = require('../icons/go-to-rally-point-red.png')

import { LoadMissionPanel } from './LoadMissionPanel'
import { SaveMissionPanel } from './SaveMissionPanel'

import { gebcoLayer } from './ChartLayers';

import { BotListPanel } from './BotListPanel'
import { CommandList } from './Missions';
import { Goal, HubStatus, BotStatus, TaskType, GeographicCoordinate, MissionPlan, CommandType, MissionStart, MovementType, Command, Engineering, MissionTask } from './shared/JAIAProtobuf'
import { MapBrowserEvent, MapEvent } from 'ol'
import { PodStatus, PortalBotStatus, PortalHubStatus, isRemoteControlled } from './shared/PortalStatus'
import * as Styles from './shared/Styles'

// Jaia imports
import { SurveyLines } from './SurveyLines'
import { SurveyPolygon } from './SurveyPolygon'
import { createMap } from './Map'
import { layers } from './Layers'

import { getGeographicCoordinate } from './Utilities'
import { playDisconnectReconnectSounds } from './DisconnectSound'
import { Interactions } from './Interactions'
import { BotLayers } from './BotLayers'
import { HubLayers } from './HubLayers'

import * as JCCStyles from './Styles'
import { SurveyExclusions } from './SurveyExclusions'

// Must prefix less-vars-loader with ! to disable less-loader, otherwise less-vars-loader will get JS (less-loader
// output) as input instead of the less.
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
const lessVars = require('!less-vars-loader?camelCase,resolveVariables!../style/CommandControl.less');

const COLOR_SELECTED = lessVars.selectedColor;

punchJQuery($);
// jqueryDrawer($);

// Sorry, map is a global because it really gets used from everywhere
let map: OlMap

const viewportDefaultPadding = 100;
const sidebarInitialWidth = 0;

const POLLING_INTERVAL_MS = 500;

const MAX_RUNS: number = 99;
const MAX_GOALS = 15;

String.prototype.endsWith = function(suffix) {
	return this.slice(this.length - suffix.length, this.length) == suffix
}

// ===========================================================================================================================

// ===========================================================================================================================

var mapSettings = GlobalSettings.mapSettings

interface Props {}

export enum Mode {
	NONE = '',
	MISSION_PLANNING = 'missionPlanning',
	SET_RALLY_POINT_GREEN = "setRallyPointGreen",
	SET_RALLY_POINT_RED = "setRallyPointRed"
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
	rallyStartLocation?: GeographicCoordinate,
	rallyEndLocation?: GeographicCoordinate,
	mapLayerActive: boolean,
	missionParams: MissionParams,
	missionPlanningGrid?: {[key: string]: number[][]},
	missionPlanningLines?: any,
	missionPlanningFeature?: OlFeature<Geometry>,
	missionBaseGoal: Goal,
	missionEndTask: MissionTask,
	surveyPolygonFeature?: OlFeature<Geometry>,
	surveyPolygonActive: boolean,
	surveyPolygonGeoCoords?: Coordinate[],
	surveyPolygonCoords?: LineString,
	surveyPolygonChanged: boolean,
	surveyExclusionCoords?: number[][],
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
	/**
	 * Incremented when runList has changed and mission needs a re-render
	 */
	runListVersion: number
	undoRunListStack: MissionInterface[],
	remoteControlInterval?: ReturnType<typeof setInterval>,
	remoteControlValues: Engineering

	center_line_string: turf.helpers.Feature<turf.helpers.LineString>

	podStatus: PodStatus
	/**
	 * Incremented when podStatus is changed and needs a re-render
	 */
	podStatusVersion: number
}

export default class CommandControl extends React.Component {

	props: Props
	state: State

	mapDivId = `map-${Math.round(Math.random() * 100000000)}`
	api = jaiaAPI

	botLayers: BotLayers
	hubLayers: HubLayers

	flagNumber = 1

	surveyLines: SurveyLines
	surveyPolygon: SurveyPolygon
	surveyExclusions: SurveyExclusions

	timerID: NodeJS.Timer

	oldPodStatus?: PodStatus

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
			podStatusVersion: 0,
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
			rallyStartLocation: null,
			rallyEndLocation: null,
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
			missionBaseGoal: {
				task: {
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
			},
			missionEndTask: {type: TaskType.NONE},
			surveyPolygonFeature: null,
			surveyPolygonActive: false,
			surveyPolygonGeoCoords: null,
			surveyPolygonCoords: null,
			surveyPolygonChanged: false,
			surveyExclusionCoords: null,
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
				links: false
			},
			mapLayerActive: false, 
			engineeringPanelActive: false,
			missionPanelActive: false,
			runList: null,
			runListVersion: 0,
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

		// Survey exclusions
		this.surveyExclusions = new SurveyExclusions(map, (surveyExclusionCoords: number[][]) => {
			this.setState({ surveyExclusionCoords })
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
	}

	/**
	 * Gets the current podStatus
	 * 
	 * @returns Current podStatus
	 */
	getPodStatus() {
		return this.state.podStatus
	}

	/**
	 * Sets the current podStatus, and triggers a map re-render
	 * 
	 * @param podStatus New podStatus
	 */
	setPodStatus(podStatus: PodStatus) {
		this.setState({podStatus, podStatusVersion: this.state.podStatusVersion + 1})
	}

	genMission() {
		this.generateMissions();
	}

	changeMissionBotList() {
		console.log('changeMissionBotList');
	}

	changeMissionMode() {
		if (this.state.missionParams.mission_type === 'polygon-grid')
			this.changeInteraction(this.surveyPolygon.drawInteraction, 'crosshair');
		if (this.state.missionParams.mission_type === 'editing')
			this.changeInteraction(this.interactions.selectInteraction, 'grab');
		if (this.state.missionParams.mission_type === 'lines')
			this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
		if (this.state.missionParams.mission_type === 'exclusions')
			this.changeInteraction(this.surveyExclusions.interaction, 'crosshair');
	}

	componentDidMount() {
		// Class that keeps track of the bot layers, and updates them
		this.botLayers = new BotLayers(map)
		this.hubLayers = new HubLayers(map)

		map.setTarget(this.mapDivId);

		const viewport = document.getElementById(this.mapDivId);
		map.getView().setMinZoom(Math.ceil(Math.LOG2E * Math.log(viewport.clientWidth / 256)));

		this.timerID = setInterval(() => this.pollPodStatus(), 0);

		($('.panel > h2') as any).disableSelection();

		($('button') as any).disableSelection();

		this.setupMapLayersPanel()

		// Hotkeys
		document.onkeydown = this.keyPressed.bind(this)

		info('Welcome to Jaia Command & Control!');
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

		/**
		 * Checks to see if a set of state variables has changed or not
		 * 
		 * @param keys state keys to check for changes
		 * @returns true if changed, false if unchanged
		 */
		const us = this
		function stateHasChanged(keys: (keyof State)[], debug=false) {
			for (const key of keys) {
				if (prevState[key] !== us.state[key]) {
					if (debug) {
						console.debug(`stateHasChanged: ${key}`)
					}
					return true
				}
			}
			return false
		}

		// Update layers derived from the podStatus
		if (prevState.podStatusVersion !== this.state.podStatusVersion ||
			prevState.selectedHubOrBot !== this.state.selectedHubOrBot) {
			this.hubLayers.update(this.state.podStatus.hubs, this.state.selectedHubOrBot)
			this.botLayers.update(this.state.podStatus.bots, this.state.selectedHubOrBot)
			this.updateActiveMissionLayer()
			playDisconnectReconnectSounds(this.oldPodStatus, this.state.podStatus)
		}

		// If we select another bot, we need to re-render the mission layer to re-color the mission lines
		// If the podStatus changes, the active_goals may have changed or a bot could be added, so re-do missionLayer
		if (prevState.selectedHubOrBot !== this.state.selectedHubOrBot ||
			prevState.runListVersion !== this.state.runListVersion ||
			prevState.podStatusVersion !== this.state.podStatusVersion) {
			this.updateMissionLayer()
		}

		// If we track a different target, or the bots change position, update tracking
		if (prevState.podStatusVersion !== this.state.podStatusVersion ||
			prevState.trackingTarget !== this.state.trackingTarget) {
			this.doTracking()
		}

		// Update the mission planning layer whenever relevant state changes
		const botsChanged = (prevState.podStatus.bots.length !== this.state.podStatus.bots.length)
		if (stateHasChanged(['surveyPolygonCoords', 'missionPlanningLines', 'missionPlanningFeature', 'missionParams', 
		    	'mode', 'missionBaseGoal', 'rallyStartLocation', 'rallyEndLocation', 'missionPlanningGrid', 'missionEndTask'], false) ||
				botsChanged) {
			this.updateMissionPlanningLayer()
		}

		// If user changed rally point locations
		if (prevState.rallyEndLocation !== this.state.rallyEndLocation ||
			prevState.rallyStartLocation !== this.state.rallyStartLocation) {
			this.updateRallyPointFeatures()
		}
	}

	componentWillUnmount() {
		clearInterval(this.timerID)
	}

	
	setupMapLayersPanel() {
		const mapLayersPanel = document.getElementById('mapLayers')
		OlLayerSwitcher.renderPanel(map, mapLayersPanel, {});

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
	}


	/**
	 * Handler for when the user presses a hotkey
	 * 
	 * @param {KeyboardEvent} e The keyboard event
	 */
	keyPressed(e: KeyboardEvent) {
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
							type: CommandType.STOP
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

	doTracking() {
		const { lastBotCount, trackingTarget } = this.state;
		const bots = this.getPodStatus().bots
		const botCount = Object.keys(bots).length

        if (String(trackingTarget) in bots) {
            const trackedBot = bots[String(trackingTarget)]
            this.centerOn(getMapCoordinate(trackedBot.location, map));
        }

		if (botCount > lastBotCount) {
			this.zoomToPod(true);
		} 
		else if (trackingTarget === 'pod') {
			this.zoomToPod();
		} 

		this.setState({
			lastBotCount: botCount
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
				if (result instanceof Error) {
					hubConnectionError(result.message)
					return
				}

				if (!("bots" in result)) {
					hubConnectionError(String(result))
					return
				}

				this.oldPodStatus = this.getPodStatus()
				this.setPodStatus(result)

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

	/**
	 * Zooms the map to a bot
	 * 
	 * @param id The bot's bot_id
	 * @param firstMove 
	 */
	zoomToBot(id: number, firstMove = false) {
		const extent = this.getBotExtent(id)
		if (extent != null) {
			this.fit(extent, { duration: 100 }, false, firstMove);
		}
	}

	
	/**
	 * Zooms the map to show the entire pod of bots
	 * @date 6/22/2023 - 8:08:17 AM
	 *
	 * @param {boolean} [firstMove=false]
	 */
	zoomToPod(firstMove = false) {
		const podExtent = this.getPodExtent()
		if (podExtent != null) {
			this.fit(podExtent, { duration: 100 }, false, firstMove)
		}
	}


	toggleBot(bot_id?: number) {
		if (bot_id == null || this.isBotSelected(bot_id)) {
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

	getBotExtent(bot_id: number) {
		const zoomExtentWidth = 0.001 / 2 // Degrees
		const bot = this.getPodStatus().bots[bot_id]

		if (bot != null && bot.location != null) {
			const coordinate = getMapCoordinate(bot.location, map)
			return [
				coordinate[0] - zoomExtentWidth,
				coordinate[1] - zoomExtentWidth,
				coordinate[0] + zoomExtentWidth,
				coordinate[1] + zoomExtentWidth
			]
		}
	}

	getPodExtent() {
		const zoomExtentWidth = 0.001 / 2 // Degrees
		const bots = Object.values(this.getPodStatus().bots)

		const lons = bots.map((bot) => { return bot.location.lon }).filter((lon) => { return lon != null })
		const lats = bots.map((bot) => { return bot.location.lat }).filter((lat) => { return lat != null })

		if (lons.length == 0 || lats.length == 0) return undefined

		const minCoordinate = getMapCoordinate({ lon: Math.min(...lons) - zoomExtentWidth, lat: Math.min(...lats) - zoomExtentWidth }, map)
		const maxCoordinate = getMapCoordinate({ lon: Math.max(...lons) + zoomExtentWidth, lat: Math.max(...lats) + zoomExtentWidth }, map)

		return [
			minCoordinate[0], minCoordinate[1],
			maxCoordinate[0], maxCoordinate[1]
		]
	}

	trackBot(id: number | string) {
		const { trackingTarget } = this.state;
		if (id === trackingTarget) return;
		this.setState({ trackingTarget: id });
		if (id === 'pod') {
			this.zoomToPod(true);
			info('Following pod');
		} else if (id !== null) {
			this.zoomToBot(id as number, true);
			info(`Following bot ${id}`);
		} else if (trackingTarget === 'pod') {
			info('Stopped following pod');
		} else {
			info(`Stopped following bot ${trackingTarget}`);
		}
	}

	/**
	 * Gets the current runList
	 * 
	 * @returns Current runList
	 */
	getRunList() {
		return this.state.runList
	}

	/**
	 * Sets the runList, without pushing to the Undo stack
	 * 
	 * @param runList New runList
	 */
	setRunList(runList: MissionInterface) {
		this.setState({runList, runListVersion: this.state.runListVersion + 1})
	}
	
	/**
	 * Push the current runList onto the undoRunListStack, if different from the top runList on the stack
	 */
	pushRunListToUndoStack() {
		const { runList, undoRunListStack } = this.state

		if (undoRunListStack.length >= 1) {
			const topRunList = undoRunListStack[undoRunListStack.length - 1]
			if (equalValues(topRunList, runList)) return this
		}

		undoRunListStack.push(deepcopy(runList))
		this.setState({undoRunListStack})

		// console.debug('Pushed to undoRunListStack')
		// console.debug(deepcopy(undoRunListStack))

		return this
	}

	/**
	 * Restore the top of the runList undo stack
	 * 
	 * @returns Nothing
	 */
	restoreUndo() {
		if (!confirm('Click the OK button to undo the previous run edit that was made:')) return

		if (this.state.undoRunListStack.length >= 1) {
			const runList = this.state.undoRunListStack.pop()
			// console.debug('Popped from undoRunListStack')
			// console.debug(deepcopy(this.state.undoRunListStack))
			this.setRunList(runList)
			this.setState({goalBeingEdited: null})
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
		const length = OlGetLength(line, { projection: map.getView().getProjection() });
		if (length > 100) {
			return `${Math.round((length / 1000) * 100) / 100} km`;
		}
		return `${Math.round(length * 100) / 100} m`;
	}

	weAreInControl() {
		const {controllingClientId} = this.getPodStatus()
		return (controllingClientId == this.api.clientId) || controllingClientId == null
	}

	takeControl() {
		// Clear interval for remote control if there is one
		this.clearRemoteControlInterval();

		if (this.weAreInControl()) return true;
		return confirm('WARNING:  Another client is currently controlling the team.  Click OK to take control of the team.')
	}

    autoAssignBotsToRuns() {
        let podStatusBotIds = Object.keys(this.getPodStatus()?.bots);
        let botsAssignedToRunsIds = Object.keys(this.getRunList().botsAssignedToRuns);
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

		const runList = this.pushRunListToUndoStack().getRunList()

        botsNotAssigned.forEach((assigned_key) => {
            for (let run_key in runList.runs) {
                if (runList.runs[run_key].assigned == -1) {
                    // Delete assignment
                    delete runList.botsAssignedToRuns[runList.runs[run_key].assigned];

                    runList.runs[run_key].assigned = Number(assigned_key); 
                    runList.runs[run_key].command.bot_id = Number(assigned_key); 
                    runList.botsAssignedToRuns[runList.runs[run_key].assigned] = runList.runs[run_key].id
                    break;
                }
            }
        })

		this.setRunList(runList)
    }

	/**
	 * Delegate method from Hub and Bot Details panels, to set the expansion state of accordion sections
	 * 
	 * @param section Accordion section name
	 * @param expanded True if expanded, false otherwise
	 */
	setDetailsExpanded(section: keyof DetailsExpandedState, expanded: boolean) {
		const { detailsExpanded } = this.state
		detailsExpanded[section] = expanded
		this.setState({ detailsExpanded });
	}

	createRemoteControlInterval() {
		// Before creating a new interval, clear the current one
		this.clearRemoteControlInterval()

		this.state.remoteControlInterval = 
			setInterval(() => {
				this.api.postEngineeringPanel(this.state.remoteControlValues);
			}, 100)
	}

	clearRemoteControlInterval() {
		if (this.state.remoteControlInterval) {
			clearInterval(this.state.remoteControlInterval);
			this.state.remoteControlInterval = null
		}
	}

	weHaveRemoteControlInterval() {
		if (this.state.remoteControlInterval) {
			return true
		}
		return false
	}

	isRCModeActive(botId: number) {
		const selectedBot = this.getPodStatus().bots[botId]
		if (selectedBot?.mission_state.includes('REMOTE_CONTROL')) {
			return true
		}
		return false
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

		var runList = this.pushRunListToUndoStack().getRunList()

		let runs = runList?.runs;
		let botsAssignedToRuns = runList?.botsAssignedToRuns;

		if(!(botId in botsAssignedToRuns))
		{
			runList = Missions.addRunWithWaypoints(botId, [], runList);
		}

		// Attempted to create a run greater than MAX_RUNS
		// The check for MAX_RUNS occurs in Missions.tsx
		if (!runList) { return }

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

		this.setRunList(runList)
	}

	updateRallyPointFeatures() {
		const source = layers.rallyPointLayer.getSource()
		source.clear()

		// Add Home, if available
		if (this.state.rallyEndLocation) {
			let pt = getMapCoordinate(this.state.rallyEndLocation, map)
			const feature = new OlFeature({ geometry: new OlPoint(pt) })
			feature.setStyle(JCCStyles.rallyPointRedStyle)
			source.addFeature(feature)
		}

		if (this.state.rallyStartLocation) {
			let pt = getMapCoordinate(this.state.rallyStartLocation, map)
			const feature = new OlFeature({ geometry: new OlPoint(pt) })
			feature.setStyle(JCCStyles.rallyPointGreenStyle)
			source.addFeature(feature)
		}
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
				let botState = this.getPodStatus().bots[botIndex]?.mission_state;
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
			}
		}
	}

	// Loads the set of runs, and updates the GUI
	loadMissions(mission: MissionInterface) {
		const runList = this.pushRunListToUndoStack().getRunList()

		this.deleteAllRunsInMission(runList);
		for(let run in mission.runs)
		{
			Missions.addRunWithCommand(-1, mission.runs[run].command, runList);
		}

		this.setRunList(runList)
	}

	/**
	 * 
	 * @returns Whether any bots are assigned to runs in the current runList
	 */
	areBotsAssignedToRuns() {
		return Object.keys(this.getRunList().botsAssignedToRuns).length > 0
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
		const runList = this.pushRunListToUndoStack().getRunList()

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

	getFleetId() {
		return this.state.podStatus.hubs[0].fleet_id
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
				this.pushRunListToUndoStack()
				this.setState({
					goalBeingEdited: goal,
					goalBeingEditedBotId: botId,
					goalBeingEditedGoalIndex: goalIndex
				})
				return false
			}

			// Clicked on a bot
			const botStatus = feature.get('bot') as PortalBotStatus
			if (botStatus != null) {
				this.toggleBot(botStatus.bot_id)
				return false
			}

			// Clicked on the hub
			const hubStatus = feature.get('hub') as PortalHubStatus
			if (hubStatus) {
				this.toggleHub(hubStatus.hub_id)
				return false
			}

			// Clicked on mission planning point
			if (this.state.mode == Mode.MISSION_PLANNING) {
				this.state.selectedFeatures = new OlCollection([ feature ])
				return false
			}
		}
		else {
			this.addWaypointAtCoordinate(evt.coordinate)
			return true
		}
	}

	placeRallyPointGreenAtCoordinate(coordinate: number[]) {
		this.setState({
			rallyStartLocation: getGeographicCoordinate(coordinate, map),
			mode: ''
		})

		this.toggleMode(Mode.SET_RALLY_POINT_GREEN)
	}

	placeRallyPointRedAtCoordinate(coordinate: number[]) {
		this.setState({
			rallyEndLocation: getGeographicCoordinate(coordinate, map),
			mode: ''
		})

		this.toggleMode(Mode.SET_RALLY_POINT_RED)
	}

	stopDown(arg: boolean) {
		return false
	}

	generateMissions() {
		if (!this.takeControl()) return;

		let bot_list = [];
		for (const bot in this.getPodStatus().bots) {
			bot_list.push(this.getPodStatus().bots[bot]['bot_id'])
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

	
	/**
	 * 
	 * @date 6/23/2023 - 7:40:59 PM
	 *
	 * @returns {*} The command drawer element, with rally point buttons, stop button, flag button
	 */
	commandDrawer() {
		let element = (
			<div id="commandsDrawer">
				<Button id="system-check-all-bots" className="button-jcc" onClick={this.activateAllClicked.bind(this)}>
					<Icon path={mdiCheckboxMarkedCirclePlusOutline} title="System Check All Bots"/>
				</Button>
				<Button id="setRallyPointGreen" className="button-jcc" onClick={this.setRallyPointGreenClicked.bind(this)}>
					<img src={rallyPointGreenIcon} title="Set Start Rally" />
				</Button>
				<Button id="goToRallyGreen" className="button-jcc" onClick={this.goToRallyGreen.bind(this)}>
					<img src={goToRallyGreen} title="Go To Start Rally" />
				</Button>
				<Button id="setRallyPointRed" className="button-jcc" onClick={this.setRallyPointRedClicked.bind(this)}>
					<img src={rallyPointRedIcon} title="Set Finish Rally" />
				</Button>
				<Button id="goToRallyRed" className="button-jcc" onClick={this.goToRallyRed.bind(this)}>
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
				<Button className="globalCommand button-jcc" onClick={this.restoreUndo.bind(this)}>
					<Icon path={mdiArrowULeftTop} title="Undo"/>
				</Button>
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
		let panel = <SaveMissionPanel missionLibrary={MissionLibraryLocalStorage.shared()} mission={this.getRunList()} onDone={() => {
			this.setState({saveMissionPanel: null})
		}}></SaveMissionPanel>

		this.setState({saveMissionPanel: panel, loadMissionPanel: null})
	}

	setRallyPointRedClicked(evt: Event) {
		this.toggleMode(Mode.SET_RALLY_POINT_RED)
	}

	setRallyPointGreenClicked(evt: Event) {
		this.toggleMode(Mode.SET_RALLY_POINT_GREEN)
	}

	goToRallyGreen(evt: UIEvent) {
		let add_runs: CommandList = {}

		if (!this.state.rallyStartLocation) {
			alert('No green rally point selected.  Click on the map to select a green rally location and try again.')
			return
		}

		if (this.areBotsAssignedToRuns() && !confirm('Going to the green rally point will delete all runs in the mission. If the current mission is saved, select OK')) {
			return
		}

		for(let bot in this.getPodStatus().bots)
		{
			add_runs[Number(bot)] = Missions.commandWithWaypoints(Number(bot), [this.state.rallyStartLocation]);
		}

		this.runMissions(this.getRunList(), add_runs)
	}

	goToRallyRed(evt: UIEvent) {
		let add_runs: CommandList = {}

		if (!this.state.rallyEndLocation) {
			alert('No red rally point selected.  Click on the map to select a red rally location and try again.')
			return
		}

		if (this.areBotsAssignedToRuns() && !confirm('Going to the red rally point will delete all runs in the mission. If the current mission is saved, select OK')) {
			return
		}

		for(let bot in this.getPodStatus().bots)
		{
			add_runs[Number(bot)] = Missions.commandWithWaypoints(Number(bot), [this.state.rallyEndLocation]);
		}

		this.runMissions(this.getRunList(), add_runs)
	}

	playClicked(evt: UIEvent) {
		this.runMissions(this.getRunList(), null);
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

		var datum_location = this.getPodStatus()?.bots?.[botId]?.location 

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
			let selectedButton = $('#' + this.state.mode)?.removeClass('selected')
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

		return (<div className="disconnection shadowed rounded">
			<Icon path={mdiLanDisconnect} className="icon padded"></Icon>
			{msg}
		</div>)
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

	/////////////// Mission Stuff ////////////////////

	/**
	 * Updates the mission layer
	 * 
	 * Dependencies:
	 * this.state.runList,
	 * this.state.podStatus,
	 * this.state.selectedHubOrBot
	 * 
	 * Output:
	 * layers.missionLayer features
	 */
	updateMissionLayer() {
//		console.debug('updateMissionLayer')

		function getMissionFeatures(missions: MissionInterface, podStatus?: PodStatus, selectedBotId?: number) {
			const features: OlFeature[] = []
			let zIndex = 2

			for (let key in missions?.runs) {
				// Different style for the waypoint marker, depending on if the associated bot is selected or not
				let lineStyle
				let run = missions?.runs[key];
				let assignedBot = run.assigned
				const isSelected = (assignedBot === selectedBotId)
				let active_goal_index = podStatus?.bots?.[assignedBot]?.active_goal;

				// Add our goals
				const plan = run.command?.plan
				if (plan != null) {
					// Checks for run-x, run-xx, and run-xxx; Works for runs ranging from 1 to 999
					const runNumber = run.id.length === 5 ? run.id.slice(-1) : (run.id.length === 7 ? run.id.slice(-3) : run.id.slice(-2))
					const missionFeatures = MissionFeatures.createMissionFeatures(map, assignedBot, plan, active_goal_index, isSelected, runNumber, zIndex)
					features.push(...missionFeatures)
					zIndex += 1
				}
			}

			return features
		}

		const missionSource = layers.missionLayer.getSource()
		missionSource.clear()
		missionSource.addFeatures(getMissionFeatures(this.getRunList(), this.getPodStatus(), this.selectedBotId()))
	}

	/**
	 * Updates the layer showing the currently running missions on the bots.
	 * 
	 * @date 6/22/2023 - 8:05:21 AM
	 */
		updateActiveMissionLayer() {
			const bots = this.getPodStatus().bots
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
	
	/**
	 * 
	 * @returns List of botIds from podStatus
	 */
	getBotIdList() {
		return Object.keys(this.getPodStatus().bots).map((value: string) => { return Number(value) })
	}

	/**
	 * Updates the mission layer features.
	 * 
	 * Dependencies: 
	 * this.state.surveyPolygonCoords,
	 * this.state.missionPlanningLines,
	 * this.state.missionPlanningFeature,
	 * this.state.missionParams,
	 * this.state.mode,
	 * this.state.missionBaseGoal,
	 * this.state.podStatus,
	 * this.state.rallyStartLocation,
	 * this.state.rallyEndLocation,
	 * this.state.missionPlanningGrid,
	 * this.missionEndTask
	 * 
	 * Calls:
	 * this.updateMissionPlansFromMissionPlanningGrid(),
	 * this.featuresFromMissionPlanningGrid(),
	 * this.isBotSelected()
	 */
	updateMissionPlanningLayer() {
		// console.debug('updateMissionPlanningLayer start')

		// Update the mission layer
		let selectedColor = '#34d2eb'
		let unselectedColor = 'white'
		let surveyPolygonColor = '#051d61'

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

		// Place all the mission planning features in this for the missionLayer
		let missionPlanningFeaturesList: OlFeature[] = []

		const { rallyStartLocation, rallyEndLocation, missionParams, missionPlanningGrid, missionBaseGoal, missionEndTask } = this.state

		if (missionPlanningGrid) {
			this.missionPlans = getSurveyMissionPlans(this.getBotIdList(), rallyStartLocation, rallyEndLocation, missionParams, missionPlanningGrid, missionEndTask, missionBaseGoal)
			const planningGridFeatures = featuresFromMissionPlanningGrid(missionPlanningGrid, missionBaseGoal)
			missionPlanningFeaturesList.push(...planningGridFeatures)
		}

		if (this.state.surveyPolygonCoords) {
			let pts = this.state.surveyPolygonCoords.getCoordinates()
			let transformed_survey_pts = pts.map((pt) => {
				return getMapCoordinate({lon: pt[0], lat: pt[1]}, map)
			})
			let surveyPolygonFeature = new OlFeature(
				{
					geometry: new OlLineString(transformed_survey_pts),
					name: "Survey Bounds"
				}
			)
			surveyPolygonFeature.setStyle(surveyPolygonLineStyle);
			missionPlanningFeaturesList.push(surveyPolygonFeature);
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
				missionPlanningFeaturesList.push(mpLineFeatures);
			})
		}

		if (this.state.missionPlanningFeature) {
			if (this.state.missionParams.mission_type === 'lines' && this.state.mode === Mode.MISSION_PLANNING) {
				// Add the mission planning feature
				let mpFeature = this.state.missionPlanningFeature;
				mpFeature.setStyle(surveyStyle(mpFeature, this.state.missionBaseGoal.task.type))
				missionPlanningFeaturesList.push(mpFeature)
			}
		}

		const missionPlanningSource = layers.missionPlanningLayer.getSource()
		missionPlanningSource.clear()
		missionPlanningSource.addFeatures(missionPlanningFeaturesList)
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

		const podStatus = this.getPodStatus()
		const bots = podStatus?.bots
		const hubs = podStatus?.hubs

		const self = this

		let goalSettingsPanel: ReactElement = null

		if (goalBeingEdited) {
			goalSettingsPanel = (
				<GoalSettingsPanel 
					map={map}
					key={`${goalBeingEditedBotId}-${goalBeingEditedGoalIndex}`}
					botId={goalBeingEditedBotId}
					goalIndex={goalBeingEditedGoalIndex}
					goal={goalBeingEdited} 
					onChange={() => this.setRunList(this.getRunList())} 
					onClose={() => this.setState({goalBeingEdited: null})} 
				/>
			)
		}

		// Add mission generation form to UI if the survey polygon has changed.
		let missionSettingsPanel: ReactElement
		if (this.state.mode === Mode.MISSION_PLANNING) {

			missionSettingsPanel = (
				<MissionSettingsPanel
					map={map}
					mission_params={this.state.missionParams}
					center_line_string={this.state.center_line_string}
					bot_list={bots}
					missionBaseGoal={this.state.missionBaseGoal}
					missionEndTask={this.state.missionEndTask}
					onClose={() => {
						this.clearMissionPlanningState()
					}}
					onMissionChangeEditMode={() => {
						this.changeMissionMode()
					}}
					onTaskTypeChange={() => {
						this.missionPlans = null
						this.setState({missionBaseGoal: this.state.missionBaseGoal}) // Trigger re-render
					}}
					onMissionApply={(missionSettings: MissionSettings) => {
						this.setState({missionEndTask: missionSettings.endTask})

						if (this.state.missionParams.mission_type === 'lines') {
							const { rallyStartLocation, rallyEndLocation, missionParams, missionPlanningGrid, missionBaseGoal } = this.state
							this.missionPlans = getSurveyMissionPlans(this.getBotIdList(), rallyStartLocation, rallyEndLocation, missionParams, missionPlanningGrid, missionSettings.endTask, missionBaseGoal)

							const runList = this.pushRunListToUndoStack().getRunList()
							this.deleteAllRunsInMission(runList);

							for(let id in this.missionPlans)
							{
								Missions.addRunWithGoals(this.missionPlans[id].bot_id, this.missionPlans[id].plan.goal, runList);
							}

							this.setRunList(runList)

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
			)
		}

		let rcControllerPanel: ReactElement = null
		if (this.isRCModeActive(this.selectedBotId())) {
			rcControllerPanel = (
				<RCControllerPanel 
					api={this.api} 
					bot={bots[this.selectedBotId()]}  
					createInterval={this.createRemoteControlInterval.bind(this)} 
					clearInterval={this.clearRemoteControlInterval.bind(this)} 
					remoteControlValues={this.state.remoteControlValues}
					weAreInControl={this.weAreInControl.bind(this)}
					weHaveInterval={this.weHaveRemoteControlInterval.bind(this)}
					isRCModeActive={this.isRCModeActive(this.selectedBotId())}
			/>
			)
		}

		// Details box
		let detailsBoxItem = this.state.detailsBoxItem
		let detailsBox

		function closeDetails() {
			self.setState({detailsBoxItem: null})
		}

		switch (detailsBoxItem?.type) {
			case 'hub':
				const hubDetailsProps: HubDetailsProps = {
					hub: hubs?.[this.selectedHubId()],
					api: this.api,
					isExpanded: this.state.detailsExpanded,
					setDetailsExpanded: this.setDetailsExpanded.bind(this),
					getFleetId: this.getFleetId.bind(this),
					takeControl: this.takeControl.bind(this),
					closeWindow: closeDetails.bind(this),
				}
				detailsBox = <HubDetailsComponent {...hubDetailsProps} />				
				break;
			case 'bot':
				//**********************
				// TO DO  
				// The following lines assume fleets only use hub0
				//**********************
				const botDetailsProps: BotDetailsProps = {
					bot: bots?.[this.selectedBotId()], 
					hub: hubs?.[0], 
					api: this.api, 
					mission: this.getRunList(), 
					closeWindow: closeDetails.bind(this),
					takeControl: this.takeControl.bind(this),
					isExpanded: this.state.detailsExpanded,
					deleteSingleMission: this.deleteSingleRun.bind(this),
					setDetailsExpanded: this.setDetailsExpanded.bind(this),
					isRCModeActive: this.isRCModeActive.bind(this)
				}
				detailsBox = <BotDetailsComponent {...botDetailsProps} />
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

		const mapLayersButton = mapLayerActive ? (
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
		)

		const measureButton = measureActive ? (
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
		)

		const trackPodButton = (trackingTarget === 'pod' ? (
			<Button 							
				className="button-jcc active"
				onClick={() => {
					this.zoomToPod(false);
					this.trackBot(null);
				}} 
			>
				<FontAwesomeIcon icon={faMapMarkerAlt as any} title="Unfollow Bots" />
			</Button>
		) : (
			<Button
				className="button-jcc"
				onClick={() => {
					this.zoomToPod(true);
					this.trackBot('pod');
				}}
			>
				<FontAwesomeIcon icon={faMapMarkerAlt as any} title="Follow Bots" />
			</Button>
		))

		const surveyMissionSettingsButton = (surveyPolygonActive ? (
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
				}}
			>
				<FontAwesomeIcon icon={faEdit as any} title="Stop Editing Optimized Mission Survey" />
			</Button>
		) : (
			<Button
				className="button-jcc"
				onClick={() => {
					if (this.state.rallyEndLocation
							&& this.state.rallyStartLocation) {
						closeOtherViewControlWindows('missionSettingsPanel');
						this.setState({ surveyPolygonActive: true, mode: Mode.MISSION_PLANNING });
						if (this.state.missionParams.mission_type === 'polygon-grid')
							this.changeInteraction(this.surveyPolygon.drawInteraction, 'crosshair');
						if (this.state.missionParams.mission_type === 'editing')
							this.changeInteraction(this.interactions.selectInteraction, 'grab');
						if (this.state.missionParams.mission_type === 'lines')
							this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
						if (this.state.missionParams.mission_type === 'exclusions')
							this.changeInteraction(this.surveyExclusions.interaction, 'crosshair');

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
		))

		const engineeringButton = (engineeringPanelActive ? (
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
		))

		const missionPanelButton = (missionPanelActive ? (
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
		))


		return (
			<div id="jaia_container" className={containerClasses}>

				<EngineeringPanel 
					api={this.api} 
					bots={bots} 
					hubs={hubs} 
					getSelectedBotId={this.selectedBotId.bind(this)}
					getFleetId={this.getFleetId.bind(this)}
					control={this.takeControl.bind(this)} 
				/>

				<MissionControllerPanel 
					api={this.api} 
					bots={bots} 
					mission={this.getRunList()} 
					loadMissionClick={this.loadMissionButtonClicked.bind(this)}
					saveMissionClick={this.saveMissionButtonClicked.bind(this)}
					deleteAllRunsInMission={this.deleteAllRunsInMission.bind(this)}
					autoAssignBotsToRuns={this.autoAssignBotsToRuns.bind(this)}
				/>
				
				<div id={this.mapDivId} className="map-control" />

				<div id="mapLayers" />

				<div id="viewControls">

					<img className="jaia-logo button" src="/favicon.png" onClick={() => { 
						alert("Jaia Robotics\nAddress: 22 Burnside St\nBristol\nRI 02809\nPhone: P: +1 401 214 9232\n"
							+ "Comnpany Website: https://www.jaia.tech/\nDocumentation: http://52.36.157.57/index.html\n") 
						}}>	
					</img>

					{missionPanelButton}

					{engineeringButton}

					{surveyMissionSettingsButton}
					
					{trackPodButton}

					{measureButton}

					{mapLayersButton}

				</div>

				<div id="botsDrawer">
					<BotListPanel podStatus={this.getPodStatus()} 
						selectedBotId={this.selectedBotId()}
						selectedHubId={this.selectedHubId()}
						trackedBotId={this.state.trackingTarget}
						didClickBot={this.didClickBot.bind(this)}
						didClickHub={this.didClickHub.bind(this)} />
				</div>

				{detailsBox}

				{goalSettingsPanel}

				{missionSettingsPanel}

				{rcControllerPanel}

				{this.takeControlPanel()}

				{this.commandDrawer()}

				{this.state.loadMissionPanel}

				{this.state.saveMissionPanel}

				{this.disconnectionPanel()}
				
			</div>
		);
	}

}

// =================================================================================================

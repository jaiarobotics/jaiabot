import React, { MouseEvent, ReactElement } from 'react'


// Jaia Imports
import MissionControllerPanel from './mission/MissionControllerPanel'
import * as MissionFeatures from './shared/MissionFeatures'
import RCControllerPanel from './RCControllerPanel'
import EngineeringPanel from './EngineeringPanel'
import DownloadQueue from './DownloadQueue'
import RunInfoPanel from './RunInfoPanel'
import JaiaAbout from './JaiaAbout'
import { layers } from './Layers'
import { jaiaAPI } from '../../common/JaiaAPI'
import { Missions } from './Missions'
import { taskData } from './TaskPackets'
import { HubOrBot } from './HubOrBot'
import { createMap } from './Map'
import { BotLayers } from './BotLayers'
import { HubLayers } from './HubLayers'
import { CommandList } from './Missions'
import { SurveyLines } from './SurveyLines'
import { BotListPanel } from './BotListPanel'
import { Interactions } from './Interactions'
import { SurveyPolygon } from './SurveyPolygon'
import { RallyPointPanel } from './RallyPointPanel'
import { TaskPacketPanel } from './TaskPacketPanel'
import { SurveyExclusions } from './SurveyExclusions'
import { LoadMissionPanel } from './LoadMissionPanel'
import { SaveMissionPanel } from './SaveMissionPanel'
import { GoalSettingsPanel } from './GoalSettings'
import { Save, GlobalSettings } from './Settings'
import { getGeographicCoordinate } from './shared/Utilities'
import { MissionLibraryLocalStorage } from './MissionLibrary'
import { playDisconnectReconnectSounds } from './DisconnectSound'
import { error, success, warning, info } from '../libs/notifications'
import { MissionSettingsPanel, MissionSettings, MissionParams } from './MissionSettings'
import { PodStatus, PortalBotStatus, PortalHubStatus,  Metadata } from './shared/PortalStatus'
import { divePacketIconStyle, driftPacketIconStyle, getRallyStyle } from './shared/Styles'
import { createBotCourseOverGroundFeature, createBotHeadingFeature } from './shared/BotFeature'
import { getSurveyMissionPlans, featuresFromMissionPlanningGrid, surveyStyle } from './SurveyMission'
import { Goal, TaskType, GeographicCoordinate, CommandType, Command, Engineering, MissionTask } from './shared/JAIAProtobuf'
import { BotDetailsComponent, HubDetailsComponent, DetailsExpandedState, BotDetailsProps, HubDetailsProps } from './Details'


// OpenLayers
import OlMap from 'ol/Map'
import OlFeature from 'ol/Feature'
import OlCollection from 'ol/Collection'
import OlLayerSwitcher from 'ol-layerswitcher'
import OlMultiLineString from 'ol/geom/MultiLineString'
import { Coordinate } from 'ol/coordinate'
import { Interaction } from 'ol/interaction'
import { Feature, MapBrowserEvent } from 'ol'
import { getLength as OlGetLength } from 'ol/sphere'
import { deepcopy, equalValues, getMapCoordinate } from './shared/Utilities'
import { Geometry, LineString, LineString as OlLineString, Point } from 'ol/geom'
import { Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle } from 'ol/style'

// TurfJS
import * as turf from '@turf/turf'


// Styling
import Icon from '@mdi/react'
import Button from '@mui/material/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faRuler, faEdit, faLayerGroup, faWrench } from '@fortawesome/free-solid-svg-icons'
import { mdiPlay, mdiLanDisconnect, mdiCheckboxMarkedCirclePlusOutline, mdiFlagVariantPlus, mdiArrowULeftTop, mdiStop, mdiViewList, mdiDownloadMultiple, mdiProgressDownload } from '@mdi/js'
import 'reset-css'
import '../style/CommandControl.less'


// Must prefix less-vars-loader with ! to disable less-loader, otherwise less-vars-loader will get JS (less-loader output) as input instead of the less
const lessVars = require('!less-vars-loader?camelCase,resolveVariables!../style/CommandControl.less')
const rallyIcon = require('./shared/rally.svg') as string

// Sorry, map is a global because it really gets used from everywhere
let map: OlMap

const viewportDefaultPadding = 100
const sidebarInitialWidth = 0
const mapSettings = GlobalSettings.mapSettings

const POLLING_INTERVAL_MS = 500
const POLLING_META_DATA_INTERVAL_MS = 10000
const MAX_GOALS = 30

interface Props {}

export enum PanelType {
	NONE = 'NONE',
	MISSION = 'MISSION',
	ENGINEERING = 'ENGINEERING',
	MISSION_SETTINGS = 'MISSION_SETTINGS',
	MEASURE_TOOL = 'MEASURE_TOOL',
	MAP_LAYERS = 'MAP_LAYERS',
	RUN_INFO = 'RUN_INFO',
	GOAL_SETTINGS = 'GOAL_SETTINGS',
	DOWNLOAD_QUEUE = 'DOWNLOAD_QUEUE',
	RALLY_POINT = 'RALLY_POINT',
	TASK_PACKET = 'TASK_PACKET'
}

export enum Mode {
	NONE = '',
	MISSION_PLANNING = 'missionPlanning',
	NEW_RALLY_POINT = 'newRallyPoint'
}

export interface RunInterface {
	id: string,
	name: string,
	assigned: number,
	command: Command,
	canEdit: boolean
}

export interface MissionInterface {
	id: string,
	name: string,
	runs: {[key: string]: RunInterface},
	runIdIncrement: number,
	botsAssignedToRuns: {[key: number]: string}
}

interface State {
	podStatus: PodStatus
	podStatusVersion: number
	botExtents: {[key: number]: number[]},
	lastBotCount: number,

	missionParams: MissionParams,
	missionPlanningGrid?: {[key: string]: number[][]},
	missionPlanningLines?: any,
	missionPlanningFeature?: OlFeature<Geometry>,
	missionBaseGoal: Goal,
	missionEndTask: MissionTask,

	runList: MissionInterface,
	runListVersion: number
	undoRunListStack: MissionInterface[],
	editModeToggleStatus: {[botId: number]: boolean},
	flagClickedInfo: {
		runNum: number,
		botId: number,
		canDeleteRun: boolean
	}

	goalBeingEditedBotId?: number,
	goalBeingEditedGoalIndex?: number,
	goalBeingEdited?: Goal,

	selectedFeatures?: OlCollection<OlFeature>,
	selectedHubOrBot?: HubOrBot,
	measureFeature?: OlFeature,
	rallyFeatureCount: number,
	selectedRallyFeature: OlFeature<Point>
	startRally: OlFeature<Point>
	endRally: OlFeature<Point>

	mode: Mode,
	currentInteraction: Interaction | null,
	trackingTarget: number | string,
	homeLocation?: GeographicCoordinate,

	visiblePanel: PanelType,
	detailsBoxItem?: HubOrBot,
	detailsExpanded: DetailsExpandedState,
	botDownloadQueue: PortalBotStatus[],
	loadMissionPanel?: ReactElement,
	saveMissionPanel?: ReactElement,

	surveyPolygonFeature?: OlFeature<Geometry>,
	surveyPolygonGeoCoords?: Coordinate[],
	surveyPolygonCoords?: LineString,
	surveyExclusionCoords?: number[][],
	surveyPolygonChanged: boolean,
	centerLineString: turf.helpers.Feature<turf.helpers.LineString>

	remoteControlValues: Engineering
	remoteControlInterval?: ReturnType<typeof setInterval>,

	taskPacketType: string,
	taskPacketData: {[key: string]: {[key: string]: string}},
	selectedTaskPacketFeature: OlFeature,
	taskPacketIntervalId: NodeJS.Timeout,

	disconnectionMessage?: string,
	viewportPadding: number[],
	metadata: Metadata
}

export default class CommandControl extends React.Component {
	props: Props
	state: State

	api = jaiaAPI
	mapDivId = `map-${Math.round(Math.random() * 100000000)}`
	botLayers: BotLayers
	hubLayers: HubLayers
	oldPodStatus?: PodStatus
	missionPlans?: CommandList = null
	enabledEditStates: string[]
	interactions: Interactions
	surveyLines: SurveyLines
	surveyPolygon: SurveyPolygon
	surveyExclusions: SurveyExclusions
	timerID: NodeJS.Timeout
	metadataTimerID: NodeJS.Timeout
	flagNumber: number

	constructor(props: Props) {
		super(props)

		this.state = {
			podStatus: {
				bots: {},
				hubs: {},
				controllingClientId: null
			},
			podStatusVersion: 0,
			botExtents: {},
			lastBotCount: 0,

			missionParams: {
				'missionType': 'lines',
				'numBots': 4,
				'numGoals': (MAX_GOALS - 2),
				'spacing': 30,
				'orientation': 0,
				'rallySpacing': 1,
				'spArea': 0,
				'spPerimeter': 0,
				'spRallyStartDist': 0,
				'spRallyFinishDist': 0,
				'selectedBots': [],
				'useMaxLength': true
			},
			missionPlanningGrid: null,
			missionPlanningLines: null,
			missionPlanningFeature: null,
			missionBaseGoal: { task: { type: TaskType.NONE } },
			missionEndTask: {type: TaskType.NONE},

			runList: {
				id: 'mission-1',
				name: 'Mission 1',
				runs: {},
				runIdIncrement: 0,
				botsAssignedToRuns: {}
			},
			runListVersion: 0,
			undoRunListStack: [],
			editModeToggleStatus: {},
			flagClickedInfo: {
				runNum: -1,
				botId: -1,
				canDeleteRun: false
			},

			selectedHubOrBot: null,
			measureFeature: null,
			rallyFeatureCount: 1,
			selectedRallyFeature: null,
			startRally: null,
			endRally: null,

			mode: Mode.NONE,
			currentInteraction: null,
			trackingTarget: null,
			homeLocation: null,

			visiblePanel: PanelType.NONE,
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
			botDownloadQueue: [],
	
			surveyPolygonFeature: null,
			surveyPolygonGeoCoords: null,
			surveyPolygonCoords: null,
			surveyPolygonChanged: false,
			surveyExclusionCoords: null,
			selectedFeatures: null,
			centerLineString: null,

			remoteControlInterval: null,
			remoteControlValues: {
				bot_id: -1,
				pid_control: {
					throttle: 0,
					rudder: 0,
					timeout: 2
				}
			},

			taskPacketType: '',
			taskPacketData: {},
			selectedTaskPacketFeature: null,
			taskPacketIntervalId: null,

			viewportPadding: [
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding + sidebarInitialWidth
			],
			metadata: {}
		};

		// Map initializations
		map = createMap()
		this.interactions = new Interactions(this, map)
		map.addInteraction(this.interactions.pointerInteraction)
		map.addInteraction(this.interactions.translateInteraction)
		map.addInteraction(this.interactions.dragAndDropInteraction)
		// Center persistence
		map.getView().setCenter(mapSettings.center)
		map.getView().on('change:center', function() {
			mapSettings.center = map.getView().getCenter()
			Save(mapSettings)
		})
		// Zoom-level persistence
		map.getView().setZoom(mapSettings.zoomLevel)
		map.getView().on('change:resolution', function() {
			mapSettings.zoomLevel = map.getView().getZoom()
			Save(mapSettings)
		})
		// Rotation persistence
		map.getView().setRotation(mapSettings.rotation)
		map.getView().on('change:rotation', function() {
			mapSettings.rotation = map.getView().getRotation()
			Save(mapSettings)
		})

		// Set the map for the TaskData object, so it knows where to put popups, and where to get the projection transform
		taskData.map = map

		// Callbacks
		this.changeInteraction = this.changeInteraction.bind(this)
		this.sendStopAll = this.sendStopAll.bind(this)
		this.setViewport = this.setViewport.bind(this)
		this.centerOn = this.centerOn.bind(this)
		this.fit = this.fit.bind(this)

		this.surveyLines = new SurveyLines(this)
		this.surveyPolygon = new SurveyPolygon(this)
		// Survey exclusions
		this.surveyExclusions = new SurveyExclusions(map, (surveyExclusionCoords: number[][]) => {
			this.setState({ surveyExclusionCoords })
		})

		this.enabledEditStates = ['PRE_DEPLOYMENT', 'RECOVERY', 'STOPPED', 'POST_DEPLOYMENT', 'REMOTE_CONTROL']
		this.flagNumber = 1

	}

	/**
	 * Returns a human-readable string representing the length of the input geometry
	 * 
	 * @param line The line geometry to measure
	 * @returns Human-readable string representing the length of the geometry, e.g. "26 m" or "1.4 km"
	 */
	static formatLength(line: Geometry) {
		const length = OlGetLength(line, { projection: map.getView().getProjection() });
		if (length > 100) {
			return `${Math.round((length / 1000) * 100) / 100} km`;
		}
		return `${Math.round(length * 100) / 100} m`;
	}

	componentDidMount() {
		// Class that keeps track of the bot layers, and updates them
		this.botLayers = new BotLayers(map)
		this.hubLayers = new HubLayers(map)

		const viewport = document.getElementById(this.mapDivId)
		map.setTarget(this.mapDivId)
		map.getView().setMinZoom(Math.ceil(Math.LOG2E * Math.log(viewport.clientWidth / 256)))

		this.timerID = setInterval(() => this.pollPodStatus(), 0)
		this.metadataTimerID = setInterval(() => this.pollMetadata(), 0)

		this.setupMapLayersPanel()

		// Hotkeys
		document.onkeydown = this.keyPressed.bind(this)

		info('Welcome to Jaia Command & Control!')
	}

	componentDidUpdate(prevProps: Props, prevState: State, snapshot: any) {
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
				this.updateBotCourseOverGroundLayer()
				this.updateBotHeadingLayer()
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
		if (stateHasChanged(['surveyPolygonCoords', 'missionPlanningLines', 'missionPlanningFeature', 'missionParams', 'mode', 'missionBaseGoal', 'missionPlanningGrid', 'missionEndTask'], false) || botsChanged) {
			this.updateMissionPlanningLayer()
		}

		// Update the map layers panel, if needed
		if (this.state.visiblePanel == PanelType.MAP_LAYERS && prevState.visiblePanel != PanelType.MAP_LAYERS) {
			this.setupMapLayersPanel()
		}
	}

	componentWillUnmount() {
		clearInterval(this.timerID)
		clearInterval(this.metadataTimerID)
	}

	/**
	 * Handler for when the user presses a hotkey
	 * 
	 * @param {KeyboardEvent} e keyboard event
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
	
	setupMapLayersPanel() {
		const mapLayersPanel = document.getElementById('mapLayers')

		if (mapLayersPanel == null) {
			// Panel may not be visible, therefore the element is not present at the moment
			return
		}

		OlLayerSwitcher.renderPanel(map, mapLayersPanel, {});
		mapLayersPanel.addEventListener('click', handleLayerSwitcherClick)

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

	getPodExtent() {
		const zoomExtentWidth = 0.001 / 2 // Degrees
		const bots = Object.values(this.getPodStatus().bots)

		const lons = bots.map((bot) => { return bot.location?.lon })
		const lats = bots.map((bot) => { return bot.location?.lat })

		if (lons.length == 0 || lats.length == 0) return undefined

		const minCoordinate = getMapCoordinate({ lon: Math.min(...lons) - zoomExtentWidth, lat: Math.min(...lats) - zoomExtentWidth }, map)
		const maxCoordinate = getMapCoordinate({ lon: Math.max(...lons) + zoomExtentWidth, lat: Math.max(...lats) + zoomExtentWidth }, map)

		return [
			minCoordinate[0], minCoordinate[1],
			maxCoordinate[0], maxCoordinate[1]
		]
	}

	getBotExtent(bot_id: number) {
		const zoomExtentWidth = 0.001 / 2 // Degrees
		const bot = this.getPodStatus().bots[bot_id]

		if (bot && bot.location) {
			const coordinate = getMapCoordinate(bot.location, map)
			return [
				coordinate[0] - zoomExtentWidth,
				coordinate[1] - zoomExtentWidth,
				coordinate[0] + zoomExtentWidth,
				coordinate[1] + zoomExtentWidth
			]
		}
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

	/**
	 * Zooms the map to show the entire pod of bots
	 *
	 * @param {boolean} [firstMove=false]
	 */
	zoomToPod(firstMove = false) {
		const podExtent = this.getPodExtent()
		if (podExtent) {
			this.fit(podExtent, { duration: 100 }, false, firstMove)
		}
	}

	/**
	 * Zooms the map to a bot
	 * 
	 * @param id The bot's bot_id
	 * @param firstMove 
	 */
	zoomToBot(id: number, firstMove = false) {
		const extent = this.getBotExtent(id)
		if (extent) {
			this.fit(extent, { duration: 100 }, false, firstMove);
		}
	}

	centerOn(coords: number[], stopTracking = false, firstMove = false) {
		if (isNaN(coords[0]) || isNaN(coords[1])) {
			return
		}

		if (stopTracking) {
			this.trackBot(null)
		}

		const floatCoords = [coords[0], coords[1]]
		const size = map.getSize()
		const viewportPadding = this.state.viewportPadding
		const viewportCenterX = (size[0] - viewportPadding[1] - viewportPadding[3]) / 2 + viewportPadding[3]
		const viewportCenterY = (size[1] - viewportPadding[0] - viewportPadding[2]) / 2 + viewportPadding[0]
		const viewportCenter = [viewportCenterX, viewportCenterY]
		
		map.getView().centerOn(floatCoords, size, viewportCenter)
		
		if (firstMove && map.getView().getZoom() < 16) {
			map.getView().setZoom(16)
		}
	}

	fit(geom: number[], opts: any, stopTracking = false, firstMove = false) {
		if (!isFinite(geom[0]) || !isFinite(geom[1]) || !isFinite(geom[2]) || !isFinite(geom[3])) {
			return
		}

		if (stopTracking) {
			this.trackBot(null)
		}

		const { viewportPadding } = this.state
		const size = map.getSize()
		const origZoom = map.getView().getZoom()
		const optsOverride = { maxZoom: origZoom }

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
		)
	}

	/**
	 * Removes the currentInteraction, and replaces it with newInteraction, changing the cursor to cursor
	 * 
	 * @param newInteraction the new interaction to use (for example the survey line selection interaction)
	 * @param cursor the name of the cursor to use for this interaction
	 */
	changeInteraction(newInteraction: Interaction = null, cursor = '') {
		const { currentInteraction } = this.state
		
		if (currentInteraction) {
			map.removeInteraction(currentInteraction)
		}
		
		if (newInteraction) {
			map.addInteraction(newInteraction)
			this.setState({ currentInteraction: newInteraction })
		}
		
		map.getTargetElement().style.cursor = cursor
	}

	defaultInteraction() {
		this.changeInteraction();
	}

	stopDown(arg: boolean) {
		return false
	}

	changeMissionMode() {
		if (this.state.missionParams.missionType === 'polygon-grid')
			this.changeInteraction(this.surveyPolygon.drawInteraction, 'crosshair');
		if (this.state.missionParams.missionType === 'editing')
			this.changeInteraction(this.interactions.selectInteraction, 'grab');
		if (this.state.missionParams.missionType === 'lines')
			this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
		if (this.state.missionParams.missionType === 'exclusions')
			this.changeInteraction(this.surveyExclusions.interaction, 'crosshair');
	}

	clearMissionPlanningState() {
		this.setState({
			surveyPolygonActive: false,
			mode: '',
			surveyPolygonChanged: false,
			missionPlanningGrid: null,
			missionPlanningLines: null,
			centerLineString: null
		});
		this.setVisiblePanel(PanelType.NONE)
	}

	/**
	 * Gets the current metadata
	 */
	pollMetadata() {
		clearInterval(this.metadataTimerID)

		this.api.getMetadata().then(
			(result) => {
				this.setState({metadata: result})
				this.metadataTimerID = setInterval(() => this.pollMetadata(), POLLING_META_DATA_INTERVAL_MS);
			},
			(err) => {
				console.log("Meta data error response")
			}
		)
	}

	/**
	 * Use the Jaia API to poll the pod status.  This method is run at a fixed interval on a timer.
	 */
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
					} else {
						this.setState({disconnectionMessage: null})
					}
				}

				this.timerID = setInterval(() => this.pollPodStatus(), POLLING_INTERVAL_MS);
			},
			(err) => {
				console.log("Error response")
				hubConnectionError(err.message)
			}
		)
	}

	getPodStatus() {
		return this.state.podStatus
	}

	setPodStatus(podStatus: PodStatus) {
		this.setState({ podStatus, podStatusVersion: this.state.podStatusVersion + 1 })
	}

	getMetadata() {
		return this.state.metadata
	}

	toggleBot(bot_id?: number) {
		if (!bot_id || this.isBotSelected(bot_id)) {
			this.unselectHubOrBot()
		} else {
			this.selectBot(bot_id)
		}
	}

	toggleHub(id: number) {
		if (this.isHubSelected(id)) {
			this.unselectHubOrBot()
		} else {
			this.selectHub(id)
		}
	}

	didClickBot(bot_id: number) {
		this.toggleBot(bot_id)
	}

	didClickHub(hub_id: number) {
		this.toggleHub(hub_id)
	}

	selectBot(id: number) {
		this.clearRemoteControlInterval();
		const hubOrBot = {type: "bot", id: id}
		this.setState({selectedHubOrBot: hubOrBot, detailsBoxItem: hubOrBot})
	}

	selectHub(id: number) {
		this.clearRemoteControlInterval();
		const hubOrBot = {type: "hub", id: id}
		this.setState({selectedHubOrBot: hubOrBot, detailsBoxItem: hubOrBot})
	}

	selectedBotId() {
		const { selectedHubOrBot } = this.state
		if (!selectedHubOrBot || selectedHubOrBot.type != "bot") return null
		else {
			return selectedHubOrBot.id
		}
	}

	selectedHubId() {
		const { selectedHubOrBot } = this.state
		if (!selectedHubOrBot || selectedHubOrBot.type != "hub") return null
		else {
			return selectedHubOrBot.id
		}
	}

	unselectHubOrBot() {
		this.setState({selectedHubOrBot: null, detailsBoxItem: null})
	}

	isBotSelected(bot_id: number) {
		const { selectedHubOrBot } = this.state
		return selectedHubOrBot && selectedHubOrBot.type == "bot" && selectedHubOrBot.id == bot_id
	}

	isHubSelected(hub_id: number) {
		const { selectedHubOrBot } = this.state
		return selectedHubOrBot && selectedHubOrBot.type == "hub" && selectedHubOrBot.id == hub_id
	}

	getFleetId() {
		return this.state.podStatus?.hubs[this.state?.selectedHubOrBot.id]?.fleet_id
	}

	getBotIdList() {
		return Object.keys(this.getPodStatus().bots).map((value: string) => { return Number(value) })
	}

	trackBot(id: number | string) {
		const { trackingTarget } = this.state
		
		if (id === trackingTarget) return

		this.setState({ trackingTarget: id })
		
		if (id === 'pod') {
			this.zoomToPod(true)
			info('Following pod')
		} else if (id) {
			this.zoomToBot(id as number, true)
			info(`Following bot ${id}`)
		} else if (trackingTarget === 'pod') {
			info('Stopped following pod')
		} else {
			info(`Stopped following bot ${trackingTarget}`)
		}
	}

	doTracking() {
		const { lastBotCount, trackingTarget } = this.state
		const bots = this.getPodStatus().bots
		const botCount = Object.keys(bots).length

        if (String(trackingTarget) in bots) {
            const trackedBot = bots[String(trackingTarget)]
            this.centerOn(getMapCoordinate(trackedBot.location, map))
        }

		if (botCount > lastBotCount) {
			this.zoomToPod(true)
		} else if (trackingTarget === 'pod') {
			this.zoomToPod()
		} 

		this.setState({ lastBotCount: botCount })
	}

	weAreInControl() {
		const { controllingClientId } = this.getPodStatus()
		return (controllingClientId == this.api.clientId) || !controllingClientId
	}

	takeControl() {
		this.clearRemoteControlInterval()

		if (this.weAreInControl()) return true

		return confirm('WARNING:  Another client is currently controlling the team.  Click OK to take control of the team.')
	}

	genMission() {
		if (!this.takeControl()) return

		let botList = [];
		for (const bot in this.getPodStatus().bots) {
			botList.push(this.getPodStatus().bots[bot].bot_id)
		}

		this.api.postMissionFilesCreate({
			"bot_list": botList,
			"sample_spacing": this.state.missionParams.spacing,
			"mission_type": this.state.missionBaseGoal.task,
			"orientation": this.state.missionParams.orientation,
			"home_lon": this.state.homeLocation?.lon,
			"home_lat": this.state.homeLocation?.lat,
			"survey_polygon": this.state.surveyPolygonGeoCoords,
			//"inside_points_all": this.state.missionPlanningGrid.getCoordinates()
		}).then(data => {
			this.loadMissions(data);
		})
	}

	// 
	// Run List Methods (Start)
	// 
	getRunList() {
		return this.state.runList
	}

	/**
	 * Sets the runList, without pushing to the Undo stack
	 * 
	 * @param runList new runList
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

		return this
	}

	/**
	 * @returns Whether any bots are assigned to runs in the current runList
	 */
	areBotsAssignedToRuns() {
		return Object.keys(this.getRunList().botsAssignedToRuns).length > 0
	}

	getActiveRunNumbers(mission: MissionInterface) {
		const missionActiveRuns: number[] = []
		const runs = mission.runs
		for (const run of Object.values(runs)) {
			const missionState = this.getPodStatus().bots[run.assigned]?.mission_state
			if (missionState) {
				let canDelete = false
				for (const enabledState of this.enabledEditStates) {
					if (missionState.includes(enabledState)) {
						canDelete = true
					}
				}
				if (!canDelete) {
					const runNumber = Number(run.id.substring(4)) // run.id => run-x
					missionActiveRuns.push(runNumber)
				}
			}
		}
		return missionActiveRuns
	}
	
	getRun(botId: number) {
		for (const run of Object.values(this.getRunList().runs)) {
			if (run.assigned === botId) {
				return run
			}
		}
		return null
	}
	// 
	// Run List Methods (End)
	// 

	// 
	// Run Mission (Start)
	// 
	_runMission(botMission: Command) {
		// Set the speed values
		botMission.plan.speeds = GlobalSettings.missionPlanSpeeds

		console.debug('Running Mission:')
		console.debug(botMission)

		this.api.postCommand(botMission).then(response => {
			if (response.message) {
				error(response.message)
			}
		})
	}

	// Runs a set of missions, and updates the GUI
	runMissions(missions: MissionInterface, addRuns: CommandList, rallyPointRun?: boolean) {
		if (!this.takeControl()) return

		const botIds: number[] = [];
		const botIdsInIdleState: number[] = [];
		const botIdsPoorHealth: number[] = [];
		const botIdsInDownloadQueue = this.state.botDownloadQueue.map((bot) => bot.bot_id)
		const runs = missions.runs;

		for (const bot of Object.values(this.getPodStatus().bots)) {
			if (bot?.mission_state === "PRE_DEPLOYMENT__IDLE" || bot?.mission_state === "POST_DEPLOYMENT__IDLE") {
				botIdsInIdleState.push(bot?.bot_id)
			} else if (bot.health_state !== "HEALTH__OK") {
				botIdsPoorHealth.push(bot?.bot_id)
			} else if (botIdsInDownloadQueue.includes(bot.bot_id)) {
				// Do not allow a bot in the download queue to start another run
			} else {
				botIds.push(bot?.bot_id)
			}
		}

		botIds.sort()
		botIdsInIdleState.sort();
		botIdsPoorHealth.sort()

		if (botIdsInIdleState.length !== 0) {
			warning("Please activate bots: " + botIdsInIdleState);
		} else {
			if (confirm("Click the OK button to run this mission for Bots: " + botIds)) {
				if (addRuns) {
					this.deleteAllRunsInMission(missions, true, true);
					Object.keys(addRuns).map(key => {
						Missions.addRunWithCommand(Number(key), addRuns[Number(key)], missions);
					});
				}

				Object.keys(runs).map(key => {
					const botIndex = runs[key].assigned;
					if (botIndex !== -1 && !botIdsPoorHealth.includes(botIndex) && !botIdsInDownloadQueue.includes(botIndex)) {
						const runCommand = runs[key].command
						this._runMission(runCommand)
						this.setEditRunMode([botIndex], false)
					}
				})
				success("Submitted missions")
				if (botIdsPoorHealth.length > 0) {
					warning('Did not start runs for Bots: ' + botIdsPoorHealth + ' due to poor health.')
				}
			}
		}
	}
	// 
	// Run Mission (End)
	// 

	// 
	// Delete Mission (Start)
	// 
	deleteAllRunsInMission(mission: MissionInterface, needConfirmation: boolean, rallyPointRun?: boolean) {
		const activeRunNumbers = this.getActiveRunNumbers(mission)
		const warningString = this.generateDeleteAllRunsWarnStr(activeRunNumbers, rallyPointRun)
		if (needConfirmation && !confirm(warningString)) {
			return
		}
		const runs = mission.runs
		for (const run of Object.values(runs)) {
			const runNumber = Number(run.id.substring(4)) // run.id => run-x
			if (!activeRunNumbers.includes(runNumber)) {
				delete mission.runs[run.id]
				delete mission.botsAssignedToRuns[run.assigned]
			}
		}
		if (activeRunNumbers.length === 0) {
			mission.runIdIncrement = 0
		}
	}

	deleteSingleRun(runNumber?: number) {
		const runList = this.pushRunListToUndoStack().getRunList()

		const selectedBotId = this.selectedBotId()
		let runId = ''
		if (runNumber) {
			runId = `run-${runNumber}`
		} else if (runList.botsAssignedToRuns[selectedBotId]) {
			runId = runList.botsAssignedToRuns[selectedBotId]
		}

		const warningString = runNumber ? `Are you sure you want to delete Run: ${runNumber}` : `Are you sure you want to delete the run for bot: ${selectedBotId}`

		if (runId !== '' && confirm(warningString)) { 
			const run = runList.runs[runId]
			delete runList?.runs[runId]
			delete runList?.botsAssignedToRuns[run.assigned]
		}
	}

	generateDeleteAllRunsWarnStr(missionActiveRuns: number[], rallyPointRun?: boolean) {
		if (missionActiveRuns.length > 0) {
			let missionActiveRunStr = ''
			let runStr = missionActiveRuns.length > 1 ? 'Runs' : 'Run'
			for (let i = 0; i < missionActiveRuns.length; i++) {
				if (i === missionActiveRuns.length - 1) {
					missionActiveRunStr += missionActiveRuns[i]
				} else {
					missionActiveRunStr += missionActiveRuns[i] + ", "
				}
			}

			if (rallyPointRun) {
				return 'Proceeding with this action will move all bots towards the selected rally point. Select "OK" to continue:' 
			}
			return `Are you sure you want to delete all runs in this mission? Note: ${runStr} ${missionActiveRunStr} cannot be deleted while carrying out a mission`
		}
		return 'Are you sure you want to delete all runs in this mission?'
	}
	// 
	// Delete Mission (End)
	// 

	// 
	// Load + Save Missions (Start)
	//
	loadMissions(mission: MissionInterface) {
		const runList = this.pushRunListToUndoStack().getRunList()

		this.deleteAllRunsInMission(runList, true);
		for (let run in mission.runs) {
			Missions.addRunWithCommand(-1, mission.runs[run].command, runList);
		}

		this.setRunList(runList)
	}

	loadMissionButtonClicked() {
		let panel = (
			<LoadMissionPanel 
				missionLibrary={MissionLibraryLocalStorage.shared()} 
				selectedMission={(mission) => {
					this.loadMissions(mission)
					this.setState({loadMissionPanel: null})
				}} 
				onCancel={() => {
					this.setState({loadMissionPanel: null})
				}}
				areBotsAssignedToRuns={() => this.areBotsAssignedToRuns()}
			></LoadMissionPanel>
		)

		this.setState({loadMissionPanel: panel, saveMissionPanel: null})
	}

	saveMissionButtonClicked() {
		let panel = (
			<SaveMissionPanel 
				missionLibrary={MissionLibraryLocalStorage.shared()} 
				mission={this.getRunList()} 
				onDone={() => {
					this.setState({saveMissionPanel: null})
				}}
			></SaveMissionPanel>
		)

		this.setState({saveMissionPanel: panel, loadMissionPanel: null})
	
	}
	// 
	// Load + Save Missions (End)
	//

	// 
	// Transferring Mission to GUI (Start)
	// 
	getMissionFeatures(missions: MissionInterface, podStatus?: PodStatus, selectedBotId?: number) {
		const features: OlFeature[] = []
		let zIndex = 2

		for (let key in missions?.runs) {
			const run = missions?.runs[key]
			const assignedBot = run.assigned
			const isSelected = (assignedBot === selectedBotId)
			const activeGoalIndex = podStatus?.bots?.[assignedBot]?.active_goal
			const canEdit = run.canEdit

			// Add our goals
			const plan = run.command?.plan
			if (plan) {
				const runNumber = run.id.slice(4)
				const missionFeatures = MissionFeatures.createMissionFeatures(
					map, 
					this.getPodStatus().bots[assignedBot],
					plan,
					activeGoalIndex,
					isSelected,
					canEdit,
					runNumber,
					zIndex
				)
				features.push(...missionFeatures)
				zIndex += 1
			}
		}
		this.setState({ missionFeatures: features })
		return features
	}

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
		this.canEditAllBotsState()
		const missionSource = layers.missionLayer.getSource()
		const missionFeatures = this.getMissionFeatures(this.getRunList(), this.getPodStatus(), this.selectedBotId())
		missionSource.clear()
		missionSource.addFeatures(missionFeatures)
	}

	/**
	 * Updates the layer showing the currently running missions on the bots.
	 */
	updateActiveMissionLayer() {
		const bots = this.getPodStatus().bots
		let allFeatures = []

		for (let botId in bots) {
			let bot = bots[botId]

			const activeMissionPlan = bot.active_mission_plan
			const canEdit = false
			if (activeMissionPlan != null) {
				let features = MissionFeatures.createMissionFeatures(
					map, 
					bot,
					activeMissionPlan,
					bot.active_goal,
					this.isBotSelected(Number(botId)),
					canEdit
				)
				allFeatures.push(...features)
			}
		}

		let source = layers.activeMissionLayer.getSource()
		source.clear()
		source.addFeatures(allFeatures)
	}

	updateBotCourseOverGroundLayer() {
		const bots = this.getPodStatus().bots
		const allFeatures = []

		for (const bot of Object.values(bots)) {
			const feature = createBotCourseOverGroundFeature({
				map: map,
				botId: bot?.bot_id,
				lonLat: [bot?.location?.lon, bot?.location?.lat],
				heading: bot?.attitude?.heading,
				courseOverGround: bot?.attitude?.course_over_ground
			})
			allFeatures.push(feature)
		}

		const source = layers.courseOverGroundLayer.getSource()
		source.clear()
		source.addFeatures(allFeatures)
	}

	updateBotHeadingLayer() {
		const bots = this.getPodStatus().bots
		const allFeatures = []

		for (const bot of Object.values(bots)) {
			const feature = createBotHeadingFeature({
				map: map,
				botId: bot?.bot_id,
				lonLat: [bot?.location?.lon, bot?.location?.lat],
				heading: bot?.attitude?.heading,
				courseOverGround: bot?.attitude?.course_over_ground
			})
			allFeatures.push(feature)
		}

		const source = layers.headingLayer.getSource()
		source.clear()
		source.addFeatures(allFeatures)
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
	 * this.state.missionPlanningGrid,
	 * this.missionEndTask
	 * 
	 * Calls:
	 * this.updateMissionPlansFromMissionPlanningGrid(),
	 * this.featuresFromMissionPlanningGrid(),
	 * this.isBotSelected()
	 */
	updateMissionPlanningLayer() {
		// Update the mission layer
		const surveyPolygonColor = '#051d61'

		const surveyPolygonLineStyle = new OlStyle({
			fill: new OlFillStyle({color: surveyPolygonColor}),
			stroke: new OlStrokeStyle({color: surveyPolygonColor, width: 3.0}),
		})

		const surveyPlanLineStyle = new OlStyle({
			fill: new OlFillStyle({color: surveyPolygonColor}),
			stroke: new OlStrokeStyle({color: surveyPolygonColor, width: 1.0}),
		})

		// Place all the mission planning features in this for the missionLayer
		const missionPlanningFeaturesList: OlFeature[] = []
		const { missionParams, missionPlanningGrid, missionBaseGoal, missionEndTask } = this.state


		if (missionPlanningGrid) {
			this.missionPlans = getSurveyMissionPlans(this.getBotIdList(), this.state.startRally?.get('location'), this.state.endRally?.get('location'), missionParams, missionPlanningGrid, missionEndTask, missionBaseGoal)
			const planningGridFeatures = featuresFromMissionPlanningGrid(missionPlanningGrid, missionBaseGoal)
			missionPlanningFeaturesList.push(...planningGridFeatures)
		}

		if (this.state.surveyPolygonCoords) {
			let pts = this.state.surveyPolygonCoords.getCoordinates()
			let transformedSurveyPts = pts.map((pt) => {
				return getMapCoordinate({lon: pt[0], lat: pt[1]}, map)
			})
			let surveyPolygonFeature = new OlFeature({
					geometry: new OlLineString(transformedSurveyPts),
					name: "Survey Bounds"
			})
			surveyPolygonFeature.setStyle(surveyPolygonLineStyle);
			missionPlanningFeaturesList.push(surveyPolygonFeature);
		}

		if (this.state.missionPlanningLines) {
			let mpl = this.state.missionPlanningLines;
			let mplKeys = Object.keys(mpl);
			mplKeys.forEach(key => {
				let mpLineFeatures = new OlFeature({ geometry: new OlMultiLineString(mpl[key]) })
				mpLineFeatures.setProperties({'botId': key});
				mpLineFeatures.setStyle(surveyPlanLineStyle);
				missionPlanningFeaturesList.push(mpLineFeatures);
			})
		}

		if (this.state.missionPlanningFeature) {
			if (this.state.missionParams.missionType === 'lines' && this.state.mode === Mode.MISSION_PLANNING) {
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


	addWaypointAtCoordinate(coordinate: number[]) {
		this.addWaypointAt(getGeographicCoordinate(coordinate, map))
	}

	addWaypointAt(location: GeographicCoordinate) {
		const botId = this.selectedBotId()
		
		if (!botId) {
			return
		}

		let runList = this.pushRunListToUndoStack().getRunList()
		const runs = runList?.runs
		const botsAssignedToRuns = runList?.botsAssignedToRuns

		if (!(botId in botsAssignedToRuns)) {
			runList = Missions.addRunWithWaypoints(botId, [], runList, this.setEditModeToggle.bind(this));
		}

		// Attempted to create a run greater than MAX_RUNS
		// The check for MAX_RUNS occurs in Missions.tsx
		if (!runList) { return }

		if (!runs[botsAssignedToRuns[botId]]?.command) {
			runs[botsAssignedToRuns[botId]].command = Missions.commandWithWaypoints(botId, []);
		}

		const run = runs[botsAssignedToRuns[botId]]
		
		if (!run.canEdit) {
			warning('Run cannot be modified: toggle Edit in the Mission Panel or wait for the run to terminate')
			return
		}

		if (run.command.plan.goal.length < MAX_GOALS) {
			run.command.plan.goal.push({location: location})	
		} else {
			warning("Adding this goal exceeds the limit of "+ MAX_GOALS +"!");
		}

		this.setRunList(runList)
	}

	handleEvent(evt: any) {
		switch(evt.type) {
			case 'click':
				return this.clickEvent(evt as MapBrowserEvent<UIEvent>)
			case 'dragging':
				return
		}
		return true
	}

	clickEvent(evt: MapBrowserEvent<UIEvent>) {
		const map = evt.map
		const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature: OlFeature<Geometry>) {
			return feature
		})

		if (this.state.mode === 'newRallyPoint') {
			this.setState({ mode: '' })
			map.getTargetElement().style.cursor = 'default'
			this.addRallyPointAt(evt.coordinate)
			return
		}

		if (feature) {
			const botId = feature.get('botId')
			
			// Allow an operator to click on a task packet while edit mode is off
			if (!(feature?.get('type') === 'dive' || feature?.get('type') === 'drift')) {
				// Check to make sure the feature selected is not tied to a bot performing a run
				const runs = this.state.runList.runs
				for (const runIndex of Object.keys(runs)) {
					const run = runs[runIndex]
					if (run.assigned === botId) {
						if (!run.canEdit) {
							warning('Run cannot be modified: toggle Edit in the Mission Panel or wait for the run to terminate')
							return false
						}
					}
				}
			}

			// Clicked on goal / waypoint
			let goal = feature.get('goal')
			let goalIndex = feature.get('goalIndex')

			if (goal) {
				this.pushRunListToUndoStack()
				this.setState({
					goalBeingEdited: goal,
					goalBeingEditedBotId: botId,
					goalBeingEditedGoalIndex: goalIndex
				}, () => this.setVisiblePanel(PanelType.GOAL_SETTINGS))
				return false
			}

			// Clicked on bot
			const botStatus = feature.get('bot') as PortalBotStatus
			if (botStatus) {
				this.toggleBot(botStatus.bot_id)
				return false
			}

			// Clicked on hub
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

			// Clicked on flag
			const isFlag = feature.get('type') === 'flag'
			if (isFlag) {
				const runNum = feature.get('runNumber')
				const runId = `run-${runNum}`
				const runList = this.getRunList()
				const run = runList.runs[runId]
				const flagClickedInfo = {
					runNum: runNum,
					botId: run.assigned,
					canDeleteRun: this.canEditRunState(run)
				}

				this.setState({ flagClickedInfo }, () => {
					this.setVisiblePanel(PanelType.RUN_INFO)	
				})

				return false
			}

			// Clicked on rally point
			const isRallyPoint = feature.get('type') === 'rallyPoint'
			if (isRallyPoint) {
				this.setState({ selectedRallyFeature: feature }, () => this.setVisiblePanel(PanelType.RALLY_POINT))
				return
			}

			// Clicked on dive task packet
			const isDivePacket = feature.get('type') === 'dive'
			if (isDivePacket) {
				if (this.state.selectedTaskPacketFeature) {
					this.unselectTaskPacket()
				}
				
				const startTime = new Date(feature.get('startTime') / 1000)
				const endTime = new Date(feature.get('endTime') / 1000)
				const taskPacketData = {
					// Snake case used for string parsing in task packet panel
					bot_id: {value: feature.get('botId'), units: ''},
					depth_achieved: {value: feature.get('depthAchieved'), units: 'm'},
					dive_rate: {value: feature.get('diveRate'), units: 'm/s'},
					bottom_dive: {value: feature.get('bottomDive') ? 'Yes': 'No', units: ''},
					start_time: {value: startTime.toLocaleString(), units: ''},
					end_time: {value: endTime.toLocaleString(), units: ''}
				}

				this.setTaskPacketInterval(feature)

				this.setState({
					taskPacketType: feature.get('type'),
					taskPacketData: taskPacketData
				}, () => this.setVisiblePanel(PanelType.TASK_PACKET))
				return
			}

			// Clicked on drift task packet
			const isDriftPacket = feature.get('type') === 'drift'
			if (isDriftPacket) {
				if (this.state.selectedTaskPacketFeature) {
					this.unselectTaskPacket()
				}

				const startTime = new Date(feature.get('startTime') / 1000)
				const endTime = new Date(feature.get('endTime') / 1000)
				const taskPacketData = {
					// Snake case used for string parsing in task packet panel
					bot_id: {value: feature.get('botId'), units: ''},
					duration: {value: feature.get('duration'), units: 's'},
					speed: {value: feature.get('speed'), units: 'm/s'},
					drift_direction: {value: feature.get('driftDirection'), units: 'deg'},
					sig_wave_height: {value: feature.get('sigWaveHeight'), units: 'm'},
					start_time: {value: startTime.toLocaleString(), units: ''},
					end_time: {value: endTime.toLocaleString(), units: ''}
				}

				this.setTaskPacketInterval(feature)

				this.setState({
					taskPacketType: feature.get('type'),
					taskPacketData: taskPacketData
				}, () => this.setVisiblePanel(PanelType.TASK_PACKET))
				return
			}
		}
		
		if (this.state.goalBeingEdited) {
			const didWaypointMove = this.clickToMoveWaypoint(evt)
			if (didWaypointMove) { return }
		}

		this.addWaypointAtCoordinate(evt.coordinate)
	}
	// 
	// Transferring Mission to GUI (End)
	//

	// 
	// Bot Edit Mode (Start)
	// 
	canEditAllBotsState() {
		// Check that all bots are stopped or recovered
		const bots = this.getPodStatus().bots
		let canEditAll = true
		
		for (let bot of Object.values(bots)) {
			const botMissionState = bot?.mission_state
			if (!botMissionState) { continue }

			let canEditState = false
			this.enabledEditStates.forEach((enabledState) => {
				if (botMissionState.includes(enabledState)) {
					canEditState = true
				}
			})

			if (!canEditState ) {
				this.setEditRunMode([bot.bot_id], false)
				canEditAll = false
			}

			if (this.state.editModeToggleStatus[bot.bot_id]) {
				this.setEditRunMode([bot.bot_id], true)
			}
		}
		return canEditAll
	}

	canEditRunState(run: RunInterface) {
		if (!run?.assigned) {
			return
		}

		const botNum = run.assigned
		const bots = this.getPodStatus().bots
		const bot = bots[botNum]
		const missionState = bot?.mission_state

		if (missionState) {
			for (const enabledState of this.enabledEditStates) {
				if (missionState.includes(enabledState)) {
					return true
				}
			}
			return false
		} else if (run.assigned === -1) {
			return true
		}
		return false
	}

	toggleEditMode(run: RunInterface) {
        if (!run?.assigned) {
            return
        }

        const editModeToggleStatus = this.state.editModeToggleStatus
        const isChecked = !editModeToggleStatus[run.assigned]
        this.setEditRunMode([run.assigned], isChecked)
        editModeToggleStatus[run.assigned] = isChecked
        this.setState({ editModeToggleStatus })
    }

	updateEditModeToggle(run: RunInterface) {
        if (!run?.assigned) {
            return false
        }

        const botId = run.assigned
        if (!run.canEdit) {
            return false
        } else if (this.state.editModeToggleStatus[botId]) {
            return true
        }
        return false
    }

	setEditModeToggle(botId: number, isOn: boolean) {
        const editModeToggleStatus = this.state.editModeToggleStatus
        editModeToggleStatus[botId] = isOn
        this.setState({ editModeToggleStatus })
    }

	isEditModeToggleDisabled(run: RunInterface) {
		if (!run?.assigned) {
			return true
		}
		if (this.canEditRunState(run)) {
			return false
		}
		const editModeToggleStatus = this.state.editModeToggleStatus
		editModeToggleStatus[run.assigned] = false
        return true
    }

	setEditRunMode(botIds: number[], canEdit: boolean) {
		const runs = this.state.runList.runs
		botIds.forEach(botId => {
			for (const runIndex of Object.keys(runs)) {
				const run = runs[runIndex]
				if (run.assigned === botId) {
					run.canEdit = canEdit
				}
			}
		})
	}

	setMoveWptMode(canMoveWpt: boolean, botId: number, goalNum: number) {
		let run: RunInterface = null
		for (let testRun of Object.values(this.getRunList().runs)) {
			if (testRun.assigned === botId) {
				run = testRun
				break
			}
		}
		
		if (run?.command.plan?.goal[goalNum - 1]) {
			run.command.plan.goal[goalNum - 1].moveWptMode = canMoveWpt
		}
	}

	clickToMoveWaypoint(evt: MapBrowserEvent<UIEvent>) {
		const botId = this.state.goalBeingEditedBotId
		const goalNum = this.state.goalBeingEditedGoalIndex
		const geoCoordinate = getGeographicCoordinate(evt.coordinate, map)
		const runs = this.getRunList().runs
		let run: RunInterface = null

		for (const testRun of Object.values(runs)) {
			if (testRun.assigned === botId) {
				run = testRun 
			}
		}

		if (this.state.goalBeingEdited?.moveWptMode) {	
			run.command.plan.goal[goalNum -1].location = geoCoordinate
			return true
		}
		return false
	}
	// 
	// Bot Edit Mode (End)
	// 

	// 
	// Rally Points (Start)
	// 
	addRallyPointAt(coordinate: number[]) {
		const point = getMapCoordinate(getGeographicCoordinate(coordinate, map), map)
		const rallyFeature = new Feature({ geometry: new Point(point) })
		const rallyFeatureCount = this.state.rallyFeatureCount
		
		rallyFeature.setProperties({ 
			'type': 'rallyPoint', 
			'num': this.state.rallyFeatureCount,
			'location': getGeographicCoordinate(coordinate, map),
			'disableDrag': true
		})
		rallyFeature.setStyle(getRallyStyle(rallyFeatureCount))
		layers.rallyPointLayer.getSource().addFeature(rallyFeature)

		this.setState({ rallyFeatureCount: rallyFeatureCount + 1 })
	}

	goToRallyPoint(rallyFeature: OlFeature<Point>) {
		const location = rallyFeature.get('location')
		let addRuns: CommandList = {}

		for(let bot in this.getPodStatus().bots) {
			addRuns[Number(bot)] = Missions.commandWithWaypoints(Number(bot), [location]);
		}

		this.runMissions(this.getRunList(), addRuns, true)
		this.setVisiblePanel(PanelType.NONE)
	}

	deleteRallyPoint(rallyFeature: OlFeature) {
		layers.rallyPointLayer.getSource().removeFeature(rallyFeature)
		this.setVisiblePanel(PanelType.NONE)
	}

	setSelectedRallyPoint(rallyPoint: OlFeature<Geometry>, isStart: boolean) {
		if (isStart) {
			this.setState({ startRally: rallyPoint })
		} else {
			this.setState({ endRally: rallyPoint})
		}
	}

	handleJccContainerClick() {
		if (this.state.mode === 'newRallyPoint') {
			this.setState({ mode: '' })
			map.getTargetElement().style.cursor = 'default'
		}
	}
	// 
	// Rally Points (End)
	//

	// 
	// Task Packets (Start)
	// 
	updateTaskPacketLayer() {
		const feature = this.state.selectedTaskPacketFeature
		if (!feature) {
			return
		}

		const styleFunction = feature.get('type') === 'dive' ? divePacketIconStyle : driftPacketIconStyle

		if (feature.get('animated')) {
			feature.setStyle(styleFunction(feature, feature.get('type') === 'dive' ? 'white' : 'darkorange'))
		} else {
			feature.setStyle(styleFunction(feature, 'black'))
		}
		feature.set('animated', !feature.get('animated'))
	}

	unselectTaskPacket() {
		const features = taskData.taskPacketInfoLayer.getSource().getFeatures()
		for (const feature of features) {
			if (feature.get('selected')) {
				feature.set('selected', false)
				// Reset style
				const styleFunction = feature.get('type') === 'dive' ? divePacketIconStyle : driftPacketIconStyle
				feature.setStyle(styleFunction(feature, feature.get('type') === 'dive' ? 'white' : 'darkorange'))
			}
		}
		clearInterval(this.state.taskPacketIntervalId)
		this.setState({ selectedTaskPacketFeature: null })
	}

	setTaskPacketInterval(selectedFeature: Feature) {
		const taskPacketFeatures = taskData.taskPacketInfoLayer.getSource().getFeatures()
		const styleFunction = selectedFeature.get('type') === 'dive' ? divePacketIconStyle : driftPacketIconStyle
		for (const taskPacketFeature of taskPacketFeatures) {
			if (taskPacketFeature.get('id') === selectedFeature.get('id')) {
				selectedFeature.set('selected', true)
				selectedFeature.setStyle(styleFunction(selectedFeature, 'black'))
				selectedFeature.set('animated', !selectedFeature.get('animated'))
				// Start interval that sets the style
				const taskPacketIntervalId = setInterval(() => {
					this.updateTaskPacketLayer()
				}, 1000)
				this.setState({ selectedTaskPacketFeature: selectedFeature, taskPacketIntervalId })
			}
		}
	}
	// 
	// Task Packets (End)
	// 

	// 
	// RC Mode (Start)
	// 
	isRCModeActive(botId: number) {
		const selectedBot = this.getPodStatus().bots[botId]
		if (selectedBot?.mission_state.includes('REMOTE_CONTROL')) {
			return true
		}
		return false
	}

	createRemoteControlInterval() {
		this.clearRemoteControlInterval()

		this.state.remoteControlInterval = setInterval(() => {
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

	runRCMode() {
		let botId = this.selectedBotId()
		
		if (!botId) {
			warning("No bots selected")
			return
		}

		var datumLocation = this.getPodStatus()?.bots?.[botId]?.location 

		if (!datumLocation) {
			const warningString = 'RC mode issued, but bot has no location.  Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

			if (!confirm(warningString)) {
				return
			}

			datumLocation = {lat: 0, lon: 0}
		}
	}
	// 
	// RC Mode (End)
	//

	//
	// Download Queue (Start)
	//
	async processDownloadAllBots() {
		const downloadableBots = this.getDownloadableBots()
		const downloadableBotIds = downloadableBots.map((bot) => bot.bot_id)

		if (downloadableBotIds.length === 0) {
			info('All bots eligible for data download are queued')
			return
		}

		if (!confirm(`Would you like to do a data download for Bot${downloadableBots.length > 1 ? 's': ''}:  ${downloadableBotIds}`)) { return }

		const queue = this.state.botDownloadQueue
		const updatedQueue = queue.concat(downloadableBots)
		this.setState({ botDownloadQueue: updatedQueue }, () => this.downloadBotsInOrder())
		info('Open the Download Panel to see the bot download queue')
	}

	async processDownloadSingleBot(bot: PortalBotStatus) {
		if (!confirm(`Would you like to do a data download for Bot ${bot.bot_id}?`)) { return }
		
		const queue = this.state.botDownloadQueue
		if (queue.length > 0) {
			for (const queuedBot of queue) {
				if (queuedBot.bot_id === bot.bot_id) {
					info(`Bot ${bot.bot_id} is already queued`)
					return
				}
			}
		}
		const updatedQueue = queue.concat(bot)
		info(`Queued Bot ${bot.bot_id} for data download`)
		this.setState({ botDownloadQueue: updatedQueue }, () => this.downloadBotsInOrder())
	}

	async downloadBotsInOrder() {
		const queue = this.state.botDownloadQueue
		for (const bot of queue) {
			const updatedQueueIds = this.state.botDownloadQueue.map((bot) => bot.bot_id) // Needed to update the queue list when downloads are added after the queue started
			if (updatedQueueIds.includes(bot.bot_id)) {
				await this.downloadBot(bot, bot.mission_state === 'POST_DEPLOYMENT__IDLE')
				this.removeBotFromQueue(bot)
			}
		}
	}

	async downloadBot(bot: PortalBotStatus, retryDownload: boolean) {
		try {
			await this.startDownload(bot, retryDownload)
			await this.waitForPostDepoloymentIdle(bot, retryDownload)
		} catch (error) {
			console.error('Function: downloadBot', error)
		}
	}

	async startDownload(bot: PortalBotStatus, retryDownload: boolean) {
		const command = {
			bot_id: bot.bot_id,
			type: retryDownload ? CommandType.RETRY_DATA_OFFLOAD : CommandType.RECOVERED
		}

		try {
			await this.api.postCommand(command)
			console.log('Command', command)
		} catch (error) {
			console.error('Function: startDownload', error)
		}
	}

	waitForPostDepoloymentIdle(bot: PortalBotStatus, retryDownload?: boolean) {
		const timeoutTime = retryDownload ? 4000 : 0 // Accounts for lag in swithcing states
		return new Promise<void>((resolve, reject) => {
			setTimeout(() => {
				const intervalId = setInterval(() => {
					if (this.getBotMissionState(bot.bot_id) === 'POST_DEPLOYMENT__IDLE') {
						clearInterval(intervalId)
						resolve()
					} 
				}, 1000)
			}, timeoutTime)
		})
	}

	removeBotFromQueue(bot: PortalBotStatus) {
		const downloadStates = ['POST_DEPLOYMENT__DATA_PROCESSING', 'POST_DEPLOYMENT__DATA_OFFLOAD']
        if (downloadStates.includes(this.getBotMissionState(bot.bot_id)) && !confirm('Removing this bot will not cancel the download, but it will allow the other bots to move up in the queue. You may experience slower download speeds. Select OK if you would like to continue:')) {
            return
        }
		
		const queue = this.state.botDownloadQueue
		const updatedQueue = queue.filter((queuedBot) => {
			if (!(queuedBot.bot_id === bot.bot_id)) {
				return queuedBot
			}
		})

		this.setState({ botDownloadQueue: updatedQueue }, () => this.downloadBotsInOrder())
	}

	getDownloadableBots() {
		const downloadableBots: PortalBotStatus[] = []
		const bots = this.getPodStatus().bots
		for (const bot of Object.values(bots)) {
			for (const enabledState of this.enabledEditStates) {
				if (bot?.mission_state.includes(enabledState) && bot?.wifi_link_quality_percentage && !this.isBotInQueue(bot)) {
					downloadableBots.push(bot)
					break
				}
			}
		}
		return downloadableBots
	}

	getBotMissionState(botId: number) {
		// Need external function to get most up-to-date mission state, else mission state stays the same in async operations
		const bots = this.getPodStatus().bots
		return bots[botId].mission_state
	}

	getBotDownloadPercent(botId: number) {
		const bots = this.getPodStatus().bots
		return bots[botId]?.data_offload_percentage
	}

	isBotInQueue(bot: PortalBotStatus) {
		const queue = this.state.botDownloadQueue
		for (const queuedBot of queue) {
			if (queuedBot.bot_id === bot.bot_id) {
				return true
			}
		}
		return false
	}
	// 
	// Download Queue (End)
	//

	// 
	// Command Drawer (Start)
	//
	commandDrawer() {
		const botsAreAssignedToRuns = this.areBotsAssignedToRuns()

		let element = (
			<div id="commandsDrawer">
				<Button id="system-check-all-bots" className="button-jcc" onClick={this.activateAllClicked.bind(this)}>
					<Icon path={mdiCheckboxMarkedCirclePlusOutline} title="System Check All Bots"/>
				</Button>
				<Button className={`button-jcc ${this.state.mode === 'newRallyPoint' ? 'selected' : ''}`} title='Add Rally Point' onClick={this.rallyButtonClicked.bind(this)}>
					<img src={rallyIcon} />
				</Button>
				<Button className="button-jcc" style={{"backgroundColor":"#cc0505"}} onClick={this.sendStopAll.bind(this)}>
				    <Icon path={mdiStop} title="Stop All Missions" />
				</Button>
				<Button id="missionStartStop" className={`button-jcc stopMission ${(botsAreAssignedToRuns ? '' : 'inactive')}`} onClick={this.playClicked.bind(this)}>
					<Icon path={mdiPlay} title="Run Mission"/>
				</Button>
				<Button id="downloadAll" className={`button-jcc`} onClick={() => this.processDownloadAllBots()}>
					<Icon path={mdiDownloadMultiple} title="Download All"/>
				</Button>
				<Button className="globalCommand button-jcc" onClick={this.restoreUndo.bind(this)}>
					<Icon path={mdiArrowULeftTop} title="Undo"/>
				</Button>
				<Button className="button-jcc" onClick={this.sendFlag.bind(this)}>
					<Icon path={mdiFlagVariantPlus} title="Flag"/>
				</Button>
				<img className="jaia-logo button" src="/favicon.png" onClick={() => {
						const jaiaInfoContainer = document.getElementById('jaiaAboutContainer') as HTMLElement
				 		jaiaInfoContainer.style.display = "grid"
					}}>
				</img>
			</div>
		)

		return element
	}

	activateAllClicked(evt: UIEvent) {
		if (!this.takeControl() || !confirm('Click the OK button to run a system check for all active bots:')) return;

		this.api.allActivate().then(response => {
			if (response.message) {
				error(response.message)
			} else {
				info("Sent Activate All")
			}
		})
	}

	rallyButtonClicked() {
		if (this.state.mode === 'newRallyPoint') {
			this.setState({ mode: '' })
			map.getTargetElement().style.cursor = 'default'
		} else {
			this.setState({ mode: 'newRallyPoint' })
			map.getTargetElement().style.cursor = 'crosshair'
		}
	}

	sendStopAll() {
		if (!this.takeControl() || !confirm('Click the OK button to stop all missions:')) return

		this.api.allStop().then(response => {
			if (response.message) {
				error(response.message)
			} else {
				info("Sent STOP")
			}
		})
	}

	playClicked(evt: UIEvent) {
		if (!this.areBotsAssignedToRuns()) {
			alert('There are no runs assigned to bots yet.  Please assign one or more runs to one or more bots before you can run the mission.')
			return
		}

		this.runMissions(this.getRunList(), null);
	}

	recoverAllClicked(evt: UIEvent) {
		if (!this.takeControl() || !confirm('Click the OK button to recover all active bots:')) return

		this.api.allRecover().then(response => {
				if (response.message) {
						error(response.message)
				} else {
						info("Sent Recover All")
				}
		})
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

	/**
	 * Restore the top of the runList undo stack
	 * 
	 * @returns Nothing
	 */
	restoreUndo() {
		if (!confirm('Click the OK button to undo the previous run edit that was made:')) return

		if (this.state.undoRunListStack.length >= 1) {
			const runList = this.state.undoRunListStack.pop()
			this.setRunList(runList)
			this.setState({goalBeingEdited: null})
		} else {
			info("There is no goal or task to undo!");
		}
	}
	// 
	// Command Drawer (End)
	// 

	// 
	// Mission Contoroller Panel Helper Methods (Start)
	// 
	autoAssignBotsToRuns() {
        let podStatusBotIds = Object.keys(this.getPodStatus()?.bots);
        let botsAssignedToRunsIds = Object.keys(this.getRunList().botsAssignedToRuns);
        let botsNotAssigned: number[] = [];

		// Find the difference between the current botIds available and the bots that are already assigned to get the ones that have not been assigned yet
        podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key)) {
                let id = Number(key);
                if(isFinite(id)) {
                    botsNotAssigned.push(id);
                }
            }
        })

		const runList = this.pushRunListToUndoStack().getRunList()

        botsNotAssigned.forEach((assignedKey) => {
            for (let runKey in runList.runs) {
                if (runList.runs[runKey].assigned == -1) {
                    // Delete assignment
                    delete runList.botsAssignedToRuns[runList.runs[runKey].assigned]

                    runList.runs[runKey].assigned = Number(assignedKey)
                    runList.runs[runKey].command.bot_id = Number(assignedKey)
                    runList.botsAssignedToRuns[runList.runs[runKey].assigned] = runList.runs[runKey].id
                    break
                }
            }
        })

		this.setRunList(runList)
    }
	// 
	// Mission Contoroller Panel Helper Methods (End)
	// 

	// 
	// Render Helper Methods and Panels (Start)
	// 
	canUseSurveyTool() {
		// Check that all bots are stopped or recovered
		const canEditMissionState = this.canEditAllBotsState()
		if (!canEditMissionState) { 
			warning('All bots must be stopped or recovered to use the mission survey tool')
			return false
		}
		// Check that rally points are set
		if (layers.rallyPointLayer.getSource().getFeatures().length < 2) {
			warning('At least 2 rally points are needed to use the mission survey tool')
			return false
		}
		return true
	}

	/**
	 * Switch the visible panel
	 * 
	 * @param panelType The panel type to switch to
	 */
	setVisiblePanel(panelType: PanelType) {
		switch (this.state.visiblePanel) {
			case PanelType.MISSION_SETTINGS:
				this.changeInteraction();
				this.setState({
					mode: Mode.NONE,
					surveyPolygonChanged: false,
					missionPlanningGrid: null,
					missionPlanningLines: null,
					goalBeingEdited: null,
					centerLineString: null
				});
				break;
			
			case PanelType.MEASURE_TOOL:
				this.changeInteraction()
				break;

			default:
				break;
		}
		// Clean up in case a task packet was selected and the user clicked to open a different panel
		if (panelType !== 'TASK_PACKET') {
			this.unselectTaskPacket()
		}

		this.setState({ visiblePanel: panelType })
	}

	setDetailsExpanded(accordian: keyof DetailsExpandedState, isExpanded: boolean) {
		let detailsExpanded = this.state.detailsExpanded
		detailsExpanded[accordian] = isExpanded
		this.setState({ detailsExpanded })
	}

	disconnectionPanel() {
		let msg = this.state.disconnectionMessage
		if (!msg) {
			return null
		}

		return (<div className="disconnection shadowed rounded">
			<Icon path={mdiLanDisconnect} className="icon padded"></Icon>
			{msg}
		</div>)
	}

	takeControlPanel() {
		if (this.weAreInControl()) {
			return null
		}

		const takeControl = (evt: MouseEvent) => {
			this.api.takeControl()
		}

		return (
			<div className="take-control-panel">
				Another client is in control of this team
				<Button className="button-jcc" id="takeControlButton" onClick={takeControl}>Take Control</Button>
			</div>
		)
	}
	// 
	// Render Helper Methods and Panels (End)
	// 
	
	// 
	// React Render
	// 
	render() {
		const {
			visiblePanel,
			trackingTarget,
			goalBeingEdited,
			goalBeingEditedBotId,
			goalBeingEditedGoalIndex
		} = this.state;
		
		// Are we currently in control of the bots?
		const containerClasses = this.weAreInControl() ? 'controlling' : 'noncontrolling'

		const podStatus = this.getPodStatus()
		const bots = podStatus?.bots
		const hubs = podStatus?.hubs
		const metadata = this.getMetadata();

		const self = this

		// Add mission generation form to UI if the survey polygon has changed.
		let missionSettingsPanel: ReactElement
		if (this.state.mode === Mode.MISSION_PLANNING) {

			missionSettingsPanel = (
				<MissionSettingsPanel
					map={map}
					missionParams={this.state.missionParams}
					missionPlanningGrid={this.state.missionPlanningGrid}
					missionBaseGoal={this.state.missionBaseGoal}
					missionEndTask={this.state.missionEndTask}
					rallyFeatures={layers.rallyPointLayer.getSource().getFeatures()}
					centerLineString={this.state.centerLineString}
					botList={bots}
					
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
					onMissionApply={(missionSettings: MissionSettings, startRally: OlFeature, endRally: OlFeature) => {
						this.setState({ missionEndTask: missionSettings.endTask, startRally, endRally })

						if (this.state.missionParams.missionType === 'lines') {
							const { missionParams, missionPlanningGrid, missionBaseGoal } = this.state
							const rallyStartLocation = startRally.get('location')
							const rallyEndLocation = endRally.get('location')

							this.missionPlans = getSurveyMissionPlans(this.getBotIdList(), rallyStartLocation, rallyEndLocation, missionParams, missionPlanningGrid, missionSettings.endTask, missionBaseGoal)

							const runList = this.pushRunListToUndoStack().getRunList()
							this.deleteAllRunsInMission(runList, false);

							for (let id in this.missionPlans) {
								Missions.addRunWithGoals(this.missionPlans[id].bot_id, this.missionPlans[id].plan.goal, runList, this.setEditModeToggle.bind(this));
							}

							this.setRunList(runList)

							// Close panel after applying
							this.setVisiblePanel(PanelType.NONE)
						} else {
							// Polygon
							this.genMission()
						}
					}}
					setSelectedRallyPoint={this.setSelectedRallyPoint.bind(this)}
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
				const botDetailsProps: BotDetailsProps = {
					bot: bots?.[this.selectedBotId()], 
					hub: hubs?.[Object.keys(hubs)[0]], 
					api: this.api, 
					mission: this.getRunList(),
					run: this.getRun(this.selectedBotId()),
					isExpanded: this.state.detailsExpanded,
					downloadQueue: this.state.botDownloadQueue,
					closeWindow: closeDetails.bind(this),
					takeControl: this.takeControl.bind(this),
					deleteSingleMission: this.deleteSingleRun.bind(this),
					setDetailsExpanded: this.setDetailsExpanded.bind(this),
					isRCModeActive: this.isRCModeActive.bind(this),
					updateEditModeToggle: this.updateEditModeToggle.bind(this),
					isEditModeToggleDisabled: this.isEditModeToggleDisabled.bind(this),
					toggleEditMode: this.toggleEditMode.bind(this),
					downloadIndividualBot: this.processDownloadSingleBot.bind(this)
				}
				detailsBox = <BotDetailsComponent {...botDetailsProps} />
				break;
			default:
				detailsBox = null;
				this.clearRemoteControlInterval();
				break;
		}

		const mapLayersButton = (visiblePanel == PanelType.MAP_LAYERS) ? (
			<Button className="button-jcc active"
				onClick={() => {
					this.setVisiblePanel(PanelType.NONE)
				}}
			>
				<FontAwesomeIcon icon={faLayerGroup as any} title="Map Layers" />
			</Button>

		) : (
			<Button className="button-jcc"
				onClick={() => {
					this.setVisiblePanel(PanelType.MAP_LAYERS)
				}}
			>
				<FontAwesomeIcon icon={faLayerGroup as any} title="Map Layers" />
			</Button>
		)

		const measureButton = (visiblePanel == PanelType.MEASURE_TOOL) ? (
			<div>
				<div id="measureResult" />
				<Button
					className="button-jcc active"
					onClick={() => {
						this.setVisiblePanel(PanelType.NONE)
					}}
				>
					<FontAwesomeIcon icon={faRuler as any} title="Measurement Result" />
				</Button>
			</div>
		) : (
			<Button
				className="button-jcc"
				onClick={() => {
					this.setVisiblePanel(PanelType.MEASURE_TOOL)
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

		const surveyMissionSettingsButton = ((visiblePanel == PanelType.MISSION_SETTINGS) ? (
			<Button
				className="button-jcc active"
				onClick={() => {
					this.setVisiblePanel(PanelType.NONE)
				}}
			>
				<FontAwesomeIcon icon={faEdit as any} title="Stop Editing Optimized Mission Survey" />
			</Button>
		) : (
			<Button
				className="button-jcc"
				onClick={() => {
					if (!this.canUseSurveyTool()) {
						return
					}

					this.setVisiblePanel(PanelType.MISSION_SETTINGS)
					this.setState({ mode: Mode.MISSION_PLANNING })

					if (this.state.missionParams.missionType === 'polygon-grid')
						this.changeInteraction(this.surveyPolygon.drawInteraction, 'crosshair');
					if (this.state.missionParams.missionType === 'editing')
						this.changeInteraction(this.interactions.selectInteraction, 'grab');
					if (this.state.missionParams.missionType === 'lines')
						this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
					if (this.state.missionParams.missionType === 'exclusions')
						this.changeInteraction(this.surveyExclusions.interaction, 'crosshair');

					this.setState({centerLineString: null})

					info('Touch map to set first polygon point');
				}}
			>
				<FontAwesomeIcon icon={faEdit as any} title="Edit Optimized Mission Survey" />
			</Button>
		))

		const engineeringButton = (visiblePanel == PanelType.ENGINEERING ? (
			<Button className="button-jcc active" onClick={() => {
				this.setVisiblePanel(PanelType.NONE)
			}} 
			>
				<FontAwesomeIcon icon={faWrench as any} title="Engineering Panel" />
			</Button>

		) : (
			<Button className="button-jcc" onClick={() => {
				this.setVisiblePanel(PanelType.ENGINEERING)
			}} 
			>
				<FontAwesomeIcon icon={faWrench as any} title="Engineering Panel" />
			</Button>
		))

		const missionPanelButton = (visiblePanel == PanelType.MISSION ? (
			<Button className="button-jcc active" onClick={() => {
				this.setVisiblePanel(PanelType.NONE)
				}} 
			>
				<Icon path={mdiViewList} title="Mission Panel"/>
			</Button>

		) : (
			<Button className="button-jcc" onClick={() => {
				this.setVisiblePanel(PanelType.MISSION)
				}} 
			>
				<Icon path={mdiViewList} title="Mission Panel"/>
			</Button>
		))

		const downloadQueueButton = (visiblePanel == PanelType.DOWNLOAD_QUEUE ? (
			<Button className="button-jcc active" onClick={() => {
				this.setVisiblePanel(PanelType.NONE)
				}}
			>
				<Icon path={mdiProgressDownload} title="Download Queue"/>
			</Button>

		) : (
			<Button className="button-jcc" onClick={() => {
				this.setVisiblePanel(PanelType.DOWNLOAD_QUEUE)
				}}
			>
				<Icon path={mdiProgressDownload} title="Download Queue"/>
			</Button>
		))

		let visiblePanelElement: ReactElement

		switch (visiblePanel) {
			case PanelType.NONE:
				visiblePanelElement = null
				break

			case PanelType.MISSION:
				visiblePanelElement = (
					<MissionControllerPanel 
					api={this.api} 
					bots={bots} 
					mission={this.getRunList()} 
					loadMissionClick={this.loadMissionButtonClicked.bind(this)}
					saveMissionClick={this.saveMissionButtonClicked.bind(this)}
					deleteAllRunsInMission={this.deleteAllRunsInMission.bind(this)}
					autoAssignBotsToRuns={this.autoAssignBotsToRuns.bind(this)}
					setEditRunMode={this.setEditRunMode.bind(this)}
					setEditModeToggle={this.setEditModeToggle.bind(this)}
					updateEditModeToggle={this.updateEditModeToggle.bind(this)}
					isEditModeToggleDisabled={this.isEditModeToggleDisabled.bind(this)}
					toggleEditMode={this.toggleEditMode.bind(this)}
					/>
				)
				break

			case PanelType.ENGINEERING:
				visiblePanelElement = (
					<EngineeringPanel 
					api={this.api} 
					bots={bots} 
					hubs={hubs} 
					getSelectedBotId={this.selectedBotId.bind(this)}
					getFleetId={this.getFleetId.bind(this)}
					control={this.takeControl.bind(this)} 
					/>
				)
				break

			case PanelType.MISSION_SETTINGS:
				visiblePanelElement = missionSettingsPanel
				break

			case PanelType.MEASURE_TOOL:
				visiblePanelElement = null
				break

			case PanelType.MAP_LAYERS:
				visiblePanelElement = (
					<div id="mapLayers" />
				)
				break

			case PanelType.RUN_INFO:
				visiblePanelElement = (
					<RunInfoPanel
						setVisiblePanel={this.setVisiblePanel.bind(this)}
						runNum={this.state.flagClickedInfo.runNum}
						botId={this.state.flagClickedInfo.botId}
						canDeleteRun={this.state.flagClickedInfo.canDeleteRun}
						deleteRun={this.deleteSingleRun.bind(this)}
					/>
				)
				break
			case PanelType.GOAL_SETTINGS:
				visiblePanelElement = (
					<GoalSettingsPanel
						map={map}
						key={`${goalBeingEditedBotId}-${goalBeingEditedGoalIndex}`}
						botId={goalBeingEditedBotId}
						goalIndex={goalBeingEditedGoalIndex}
						goal={goalBeingEdited}
						runList={this.getRunList()}
						onChange={() => this.setRunList(this.getRunList())} 
						setVisiblePanel={this.setVisiblePanel.bind(this)}
						setMoveWptMode={this.setMoveWptMode.bind(this)}
						canEditRunState={this.canEditRunState.bind(this)} 
					/>
				)
				break

			case PanelType.DOWNLOAD_QUEUE:
				visiblePanelElement = (
					<DownloadQueue 
						downloadableBots={this.state.botDownloadQueue} 
						removeBotFromQueue={this.removeBotFromQueue.bind(this)}
						getBotDownloadPercent={this.getBotDownloadPercent.bind(this)}
					/>
				)
				break

			case PanelType.RALLY_POINT:
				visiblePanelElement = (
					<RallyPointPanel
						selectedRallyFeature={this.state.selectedRallyFeature}
						goToRallyPoint={this.goToRallyPoint.bind(this)}
						deleteRallyPoint={this.deleteRallyPoint.bind(this)}
						setVisiblePanel={this.setVisiblePanel.bind(this)}
					/>
				)
				break
			case PanelType.TASK_PACKET:
				visiblePanelElement = (
					<TaskPacketPanel 
						type={this.state.taskPacketType}
						taskPacketData={this.state.taskPacketData}
						setVisiblePanel={this.setVisiblePanel.bind(this)}
					/>
				)
				break
		}

		return (
			<div id="jcc_container" className={containerClasses} onClick={this.handleJccContainerClick.bind(this)}>

				<JaiaAbout metadata={metadata}/>

				{visiblePanelElement}

				<div id={this.mapDivId} className="map-control" />

				<div id="viewControls">

					{missionPanelButton}

					{downloadQueueButton}

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

				{rcControllerPanel}

				{this.takeControlPanel()}

				{this.commandDrawer()}

				{this.state.loadMissionPanel}

				{this.state.saveMissionPanel}

				{this.disconnectionPanel()}
				
			</div>
		)
	}
}

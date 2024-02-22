import React, { MouseEvent, ReactElement, ReactNode } from 'react'


// Jaia Imports
import MissionControllerPanel from './mission/MissionControllerPanel'
import * as MissionFeatures from './shared/MissionFeatures'
import RCControllerPanel from './RCControllerPanel'
import EngineeringPanel from './EngineeringPanel'
import MapLayersPanel from './MapLayersPanel'
import DownloadQueue from './DownloadQueue'
import RunInfoPanel from './RunInfoPanel'
import JaiaAbout from './JaiaAbout'
import { Layers, layers } from './Layers'
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
import { SettingsPanel } from './SettingsPanel'
import { RallyPointPanel } from './RallyPointPanel'
import { TaskPacketPanel } from './TaskPacketPanel'
import { SurveyExclusions } from './SurveyExclusions'
import { LoadMissionPanel } from './LoadMissionPanel'
import { SaveMissionPanel } from './SaveMissionPanel'
import { GoalSettingsPanel } from './GoalSettings'
import { Save, GlobalSettings } from './Settings'
import { MissionLibraryLocalStorage } from './MissionLibrary'
import { playDisconnectReconnectSounds } from './DisconnectSound'
import { error, success, warning, info } from '../libs/notifications'
import { CustomAlert, CustomAlertProps } from './shared/CustomAlert'
import { MissionSettingsPanel, MissionSettings, MissionParams } from './MissionSettings'
import { PodStatus, PortalBotStatus, PortalHubStatus,  Metadata } from './shared/PortalStatus'
import { divePacketIconStyle, driftPacketIconStyle, getRallyStyle } from './shared/Styles'
import { createBotCourseOverGroundFeature, createBotHeadingFeature } from './shared/BotFeature'
import { getSurveyMissionPlans, featuresFromMissionPlanningGrid, surveyStyle } from './SurveyMission'
import { BotDetailsComponent, HubDetailsComponent, DetailsExpandedState, BotDetailsProps, HubDetailsProps } from './Details'
import { Goal, TaskType, GeographicCoordinate, CommandType, Command, Engineering, MissionTask, TaskPacket, BottomDepthSafetyParams } from './shared/JAIAProtobuf'
import { getGeographicCoordinate, deepcopy, equalValues, getMapCoordinate, getHTMLDateString, getHTMLTimeString } from './shared/Utilities'


// OpenLayers
import OlMap from 'ol/Map'
import OlFeature from 'ol/Feature'
import OlCollection from 'ol/Collection'
import OlLayerSwitcher from 'ol-layerswitcher'
import OlMultiLineString from 'ol/geom/MultiLineString'
import { Coordinate } from 'ol/coordinate'
import { Interaction } from 'ol/interaction'
import { boundingExtent } from 'ol/extent.js';
import { Feature, MapBrowserEvent } from 'ol'
import { getLength as OlGetLength } from 'ol/sphere'
import { Geometry, LineString, LineString as OlLineString, Point } from 'ol/geom'
import { Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle } from 'ol/style'


// TurfJS
import * as turf from '@turf/turf'


// Styling
import Icon from '@mdi/react'
import Button from '@mui/material/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faRuler, faEdit, faLayerGroup, faWrench } from '@fortawesome/free-solid-svg-icons'
import { mdiPlay, mdiLanDisconnect, mdiCheckboxMarkedCirclePlusOutline, mdiArrowULeftTop, mdiStop, mdiViewList, mdiDownloadMultiple, mdiProgressDownload, mdiCog, mdiHelp } from '@mdi/js'
import 'reset-css'
import '../style/CommandControl.less'


// Utility
import cloneDeep from 'lodash.clonedeep'
import { HelpWindow } from './HelpWindow'

const rallyIcon = require('./shared/rally.svg') as string

// Sorry, map is a global because it really gets used from everywhere
let map: OlMap

const viewportDefaultPadding = 100
const sidebarInitialWidth = 0
const mapSettings = GlobalSettings.mapSettings

const POD_STATUS_POLL_INTERVAL = 500
const METADATA_POLL_INTERVAL = 10_000
const TASK_PACKET_POLL_INTERVAL = 5_000
const MAX_GOALS = 30
const MICROSECONDS_FACTOR = 1_000_000

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
	TASK_PACKET = 'TASK_PACKET',
	SETTINGS = 'SETTINGS'
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
}

export interface MissionInterface {
	id: string,
	name: string,
	runs: {[key: string]: RunInterface},
	runIdIncrement: number,
	botsAssignedToRuns: {[key: number]: string}
	runIdInEditMode: string
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
	missionStartTask: MissionTask,
	missionEndTask: MissionTask,

	runList: MissionInterface,
	runListVersion: number,
	flagClickedInfo: {
		runNum: number,
		botId: number,
	},

	goalBeingEdited: {
		goal?: Goal,
		originalGoal?: Goal
		goalIndex?: number,
		botId?: number,
		runNumber?: number,
		moveWptMode?: boolean
	},

	selectedFeatures?: OlCollection<OlFeature>,
	selectedHubOrBot?: HubOrBot,
	measureFeature?: OlFeature,
	rallyCounter: number,
	reusableRallyNums: number[],
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

	surveyExclusionCoords?: number[][],
	centerLineString: turf.helpers.Feature<turf.helpers.LineString>,
	bottomDepthSafetyParams: BottomDepthSafetyParams,
	isSRPEnabled: boolean

	rcModeStatus: {[botId: number]: boolean},
	remoteControlValues: Engineering,
	remoteControlInterval?: ReturnType<typeof setInterval>,
	rcDives: {[botId: number]: {[taskParams: string]: string}},

	taskPacketType: string,
	taskPacketData: {[key: string]: {[key: string]: string}},
	selectedTaskPacketFeature: OlFeature,
	taskPacketIntervalId: NodeJS.Timeout,
	taskPacketsTimeline: {[key: string]: string | boolean},
	isClusterModeOn: boolean
	isHelpWindowDisplayed: boolean

	disconnectionMessage?: string,
	viewportPadding: number[],
	metadata: Metadata

	customAlert?: ReactNode
}

interface BotAllCommandInfo {
	botIds?: number[],
	botIdsInIdleState?: number[],
	botIdsNotInIdleState?: number[],
	botIdsInStoppedState?: number[],
	botIdsPoorHealth?: number[],
	botIdsDisconnected?: number[],
	botIdsDownloadNotAvailable?: number[],
	botIdsInDownloadQueue?: number[],
	botIdsWifiDisconnected?: number[],
	idleStateMessage?: string,
	notIdleStateMessage?: string,
	stoppedStateMessage?: string,
	poorHealthMessage?: string,
	downloadQueueMessage?: string,
	disconnectedMessage?: string,
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
	taskPackets: TaskPacket[]
	taskPacketsCount: number
	enabledEditStates: string[]
	enabledDownloadStates: string[]
	interactions: Interactions
	surveyLines: SurveyLines
	surveyExclusions: SurveyExclusions
	podStatusPollId: NodeJS.Timeout
	metadataPollId: NodeJS.Timeout
	flagNumber: number
	missionHistory: MissionInterface[]

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
				'pointSpacing': 30,
				'lineSpacing': 30,
				'orientation': 0,
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
			missionStartTask: { type: TaskType.NONE },
			missionEndTask: { type: TaskType.NONE },

			runList: {
				id: 'mission-1',
				name: 'Mission 1',
				runs: {},
				runIdIncrement: 1,
				botsAssignedToRuns: {},
				runIdInEditMode: ''
			},
			runListVersion: 0,
			flagClickedInfo: {
				runNum: -1,
				botId: -1
			},
			goalBeingEdited: {},

			selectedHubOrBot: null,
			measureFeature: null,
			rallyCounter: 1,
			reusableRallyNums: [],
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

			surveyExclusionCoords: null,
			selectedFeatures: null,
			centerLineString: null,
			bottomDepthSafetyParams: {
				constant_heading: "0",
				constant_heading_time: "0",
				constant_heading_speed: "0",
				safety_depth: "0"
			},
			isSRPEnabled: false,

			rcModeStatus: {},
			remoteControlInterval: null,
			remoteControlValues: {
				bot_id: -1,
				pid_control: {
					throttle: 0,
					rudder: 0,
					timeout: 1
				}
			},
			rcDives: {},

			taskPacketType: '',
			taskPacketData: {},
			selectedTaskPacketFeature: null,
			taskPacketIntervalId: null,
			taskPacketsTimeline: {
				startDate: '', // yyyy-mm-dd
				startTime: '', // hh:mm
				endDate: '', // yyyy-mm-dd
				endTime: '', // hh:mm
				start: '', // yyyy-mm-dd hh:mm
				end: '', // yyyy-mm-dd hh:mm
				keepEndDateCurrent: true,
				isEditing: false
			},
			isClusterModeOn: true,
			isHelpWindowDisplayed: false,

			viewportPadding: [
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding,
				viewportDefaultPadding + sidebarInitialWidth
			],
			metadata: {},

			customAlert: null
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
		// Survey exclusions
		this.surveyExclusions = new SurveyExclusions(map, (surveyExclusionCoords: number[][]) => {
			this.setState({ surveyExclusionCoords })
		})

		this.podStatusPollId = null
		this.metadataPollId = null
		this.taskPackets = []
		this.taskPacketsCount = 0
		this.enabledEditStates = ['PRE_DEPLOYMENT', 'RECOVERY', 'STOPPED', 'POST_DEPLOYMENT', 'REMOTE_CONTROL']
		this.enabledDownloadStates = ['PRE_DEPLOYMENT', 'STOPPED', 'POST_DEPLOYMENT']
		this.flagNumber = 1
		this.missionHistory = []

		CustomAlert.setPresenter((props: CustomAlertProps) => {
			if (props == null) {
				this.setState({customAlert: null})
				return
			}

			this.setState({customAlert: <CustomAlert {...props}></CustomAlert>})
		})
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

		this.pollPodStatus()
		this.pollMetadata()
		setInterval(() => this.pollTaskPackets(), TASK_PACKET_POLL_INTERVAL)

		this.setupMapLayersPanel()

		const emptyMission = {
			id: '',
			name: '',
			runs: {},
			runIdIncrement: 1,
			botsAssignedToRuns: {},
			runIdInEditMode: ''
		}
		this.updateMissionHistory(emptyMission)

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
				this.updateHubCommsCircles()
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
		if (stateHasChanged(
			['missionPlanningLines', 'missionPlanningFeature', 'missionParams', 'mode', 'missionPlanningGrid', 'missionBaseGoal', 'missionStartTask', 'missionEndTask'],
			 false) || botsChanged
		) {
			this.updateMissionPlanningLayer()
		}

		// Update the map layers panel, if needed
		if (this.state.visiblePanel == PanelType.MAP_LAYERS && prevState.visiblePanel != PanelType.MAP_LAYERS) {
			this.setupMapLayersPanel()
		}
	}

	componentWillUnmount() {
		clearInterval(this.podStatusPollId)
		clearInterval(this.metadataPollId)
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
		if (this.state.missionParams.missionType === 'editing')
			this.changeInteraction(this.interactions.selectInteraction, 'grab');
		if (this.state.missionParams.missionType === 'lines')
			this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
		if (this.state.missionParams.missionType === 'exclusions')
			this.changeInteraction(this.surveyExclusions.interaction, 'crosshair');
	}

	clearMissionPlanningState() {
		this.setState({
			mode: '',
			missionPlanningGrid: null,
			missionPlanningLines: null,
			centerLineString: null
		});
		this.setVisiblePanel(PanelType.NONE)
	}

	pollMetadata() {
		this.api.getMetadata().then(
			(result) => {
				this.setState({metadata: result})
			},
			(err) => {
				console.log("Metadata polling error:\n", err)
			}
		)
		if (!this.metadataPollId) {
			this.metadataPollId = setInterval(() => this.pollMetadata(), METADATA_POLL_INTERVAL)
		}
	}

	pollPodStatus() {
		this.api.getStatus().then(
			(result) => {
				if (result instanceof Error) {
					this.hubConnectionError(result.message)
					return
				}

				if (!("bots" in result)) {
					this.hubConnectionError(String(result))
					return
				}

				this.oldPodStatus = {...this.getPodStatus()}
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
						this.setState({ disconnectionMessage: messages.error })
					} else {
						this.setState({ disconnectionMessage: null })
					}
				}
			},
			(err) => {
				this.hubConnectionError(err.message)
			}
		)
		// Starts polling interval
		if (!this.podStatusPollId) {
			this.podStatusPollId = setInterval(() => this.pollPodStatus(), POD_STATUS_POLL_INTERVAL)
		}
	}

	pollTaskPackets() {
		this.setTaskPacketDates()
		this.api.getTaskPacketsCount().then((count) => {
			// TaskPackets to be displayed is different than current display
			if (this.getTaskPacketsCount() !== count) {
			  	this.setTaskPacketsCount(count)
			
				let end = ''

				if (!this.state.taskPacketsTimeline.keepEndDateCurrent) {
					end = this.state.taskPacketsTimeline.end as string
				}
				this.api.getTaskPackets(
					this.state.taskPacketsTimeline.start as string, 
					end
				).then((taskPackets) => {
					this.setTaskPackets(taskPackets)
					taskData.updateTaskPacketsLayers(taskPackets)
				}).catch((err) => {
					console.error('Task Packets Retrieval Error:', err)
		 		})
			}
		}).catch((err) => {
			console.log('Task Packets Polling Error', err)
		})
		taskData.setTaskPacketsTimeline(this.state.taskPacketsTimeline)
	}

	hubConnectionError(errMsg: String) {
		this.setState({ disconnectionMessage: "Connection Dropped To HUB" })
		console.error(errMsg)
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

	/**
	 * Returns status age of bot
	 * @param botId Determines which status age to retrieve
	 * @returns {number} Returns status age of bot
	 */
	getBotStatusAge(botId: number) {
		let bots = this.getPodStatus().bots
		let statusAge = Math.max(0.0, bots[botId].portalStatusAge / MICROSECONDS_FACTOR)
		return statusAge
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
		if (this.state.visiblePanel === PanelType.GOAL_SETTINGS) {
			this.setMoveWptMode(false, `run-${this.state.goalBeingEdited?.runNumber}`, this.state.goalBeingEdited?.goalIndex)
			this.setVisiblePanel(PanelType.NONE)
		}
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
		return Object.keys(this.getPodStatus().bots).map((value: string) => Number(value))
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

	takeControl(onSuccess: () => void) {
		this.clearRemoteControlInterval()

		if (this.weAreInControl()) {
			onSuccess()
		}
		else {
			CustomAlert.confirm('Another client is currently controlling the team.  Take control?', 'Take Control', () => {
				this.api.takeControl()
				onSuccess()
			})
		}
	}

	// 
	// Run List Methods (Start)
	// 
	getRunList() {
		return this.state.runList
	}

	/**
	 * Updates the runList in state
	 * 
	 * @param {MissionInterface} runList Updated version used to set state
	 * @returns {void}
	 */
	setRunList(runList: MissionInterface) {
		const updatedRunList = {...runList}
		this.setState({
			runList: updatedRunList, 
			runListVersion: this.state.runListVersion + 1
		})
	}

	/**
	 * Saves a deep copy of the current mission state so the operator can restore changes
	 * 
	 * @param {MissionInterface} mission Provides current mission data to append to mission history
	 * @returns {void}
	 * 
	 * @notes
	 * The maximum size of the missionHistory array is set to the variable missionHistoryMaxLen.
	 * This is to prevent the mission history from growing unbounded and potentially causing
	 * performance issues.
	 */
	updateMissionHistory(mission: MissionInterface) {
		// this.missionHistory[0] does not get removed
		// so the number of possible undo actions equals missionHistoryMaxLen - 1
		const missionHistoryMaxLen = 11
		if (this.missionHistory.length === missionHistoryMaxLen) {
			this.missionHistory.shift()
		}
		this.missionHistory.push(deepcopy(mission))
	}

	/**
	 * @returns Whether any bots are assigned to runs in the current runList
	 */
	areBotsAssignedToRuns() {
		return Object.keys(this.getRunList().botsAssignedToRuns).length > 0
	}

	/**
	 * Check if there are runs in the mission panel
	 * 
	 * @returns {boolean} True if there are runs and false if there are no runs
	 */
	areThereRuns() {
		return Object.keys(this.getRunList().runs).length > 0
	}

	getActiveRunNumbers(mission: MissionInterface) {
		const missionActiveRuns: number[] = []
		const runs = mission.runs
		for (const run of Object.values(runs)) {
			const missionState = this.getPodStatus().bots[run.assigned]?.mission_state
			if (missionState) {
				let isActive = true
				for (const enabledState of this.enabledEditStates) {
					if (missionState.includes(enabledState)) {
						isActive = false
					}
				}
				if (isActive) {
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

	/**
	 * Determines which runs in a mission are eligible to start and plays those runs
	 * 
	 * @param {MissionInterface} mission Holds the runs 
	 * @param {CommandList} addRuns A set of runs to be added to the mission
	 * @returns {void}
	 */
	runMissions(mission: MissionInterface, addRuns: CommandList) {
		this.takeControl(() => {

			const commDest = this.determineAllCommandBots(true, false, false, false)
			const botIdsAssignedToRuns: number[] = []
			const runs = mission.runs

			if (addRuns) {
				Object.keys(addRuns).map(botIndex => {
					if (commDest.botIds.includes(Number(botIndex))) {
						botIdsAssignedToRuns.push(Number(botIndex));
					}
				});
			} else {
				Object.keys(runs).map(key => {
					const botIndex = runs[key].assigned;
					if (botIndex !== -1 && commDest.botIds.includes(botIndex)) {
						botIdsAssignedToRuns.push(botIndex);
					}
				})
			}

			botIdsAssignedToRuns.sort()

			let botsNotAssignedToRuns = commDest.botIds.filter(id => !botIdsAssignedToRuns.includes(id));

			let notAssignedMessage = ""

			if (botsNotAssignedToRuns.length > 1) {
				notAssignedMessage = "\nNot sending to bots: " + botsNotAssignedToRuns + " because they are not assigned to runs"
			} else if (botsNotAssignedToRuns.length === 1) {
				notAssignedMessage = "\nNot sending to bot: " + botsNotAssignedToRuns + " because it is not assigned to a run"
			}

			if (botIdsAssignedToRuns.length === 0) {
				CustomAlert.alert(commDest.poorHealthMessage + commDest.idleStateMessage + commDest.downloadQueueMessage + commDest.disconnectedMessage + notAssignedMessage)
			} 
			else {
				const alertText = `Run this mission for Bot${botIdsAssignedToRuns.length > 1 ? 's': ''}: ` + botIdsAssignedToRuns + 
					commDest.poorHealthMessage + commDest.idleStateMessage + commDest.downloadQueueMessage + commDest.disconnectedMessage + notAssignedMessage

				CustomAlert.confirm(alertText, 'Run Mission', () => {
					
					const doExecuteMission = () => {
						Object.keys(runs).map(key => {
							const botIndex = runs[key].assigned;
							this.setRcMode(botIndex, false)
							const runId = runs[key].id
							if (botIndex !== -1 && commDest.botIds.includes(botIndex)) {
								this._runMission(runs[key].command)
								// Turn off edit mode when run starts for completeness
								if (runs[key].id === this.getRunList().runIdInEditMode) {
									const runList = this.getRunList()
									runList.runIdInEditMode = ''
									this.setRunList(runList)
								}
							}
						})
			
						success("Submitted missions")
					}

					if (addRuns) {
						this.deleteAllRunsInMission(mission, true, true).then((confirmed: boolean) => {
							if (!confirmed) return

							Object.keys(addRuns).map(key => {
								// Mutates missions
								Missions.addRunWithCommand(Number(key), addRuns[Number(key)], mission);
							});
							// Sets state with the most up to date missions
							this.setRunList(mission)

							doExecuteMission()
						})
					}
					else {
						doExecuteMission()
					}

				})
			}
		})
	}
	// 
	// Run Mission (End)
	// 


	/**
	 * Reset mission planning
	 * 
	 * @param {MissionInterface} mission Used to access the mission state
	 * @param {boolean} needConfirmation Does the deletion require a confirmation by the opertor?
	 * @param {boolean} rallyPointMission Is the mission a rally point mission?
	 * @returns {Promise<boolean>} Did the deletion occur?
	 */
	async deleteAllRunsInMission(
		mission: MissionInterface,
		needConfirmation: boolean,
		rallyPointMission?: boolean
	) {
		return new Promise((resolve, reject) => {
			let updatedMission = {...mission}
			const doDelete = () => {
				for (const run of Object.values(mission.runs)) {
					delete updatedMission.runs[run.id]
					delete updatedMission.botsAssignedToRuns[run.assigned]
				}
				updatedMission.runIdIncrement = 1
				updatedMission.runIdInEditMode = ''
				this.setRunList(updatedMission)
				this.updateMissionHistory(updatedMission)

				resolve(true)			
			}
			
			// Check if we need a confirmation and if there are runs available 
			if (needConfirmation && this.areThereRuns()) {
				const warningString = this.generateDeleteAllRunsWarnStr(rallyPointMission)
				CustomAlert.confirm(warningString, 'Delete All Runs', doDelete, () => { resolve(false) })
			}
			else {
				doDelete()
			}
		})
	}

	/**
	 * Delete a run from the mission
	 * 
	 * @param {string} runId Determines which run to delete
	 * @param {string} disableMessage See @notes/refactor
	 * @returns {void}
	 * 
	 * @notes
	 * /refactor >> remove disable message as a parameter...this should be handled by an on click
	 *              handler for the clear run button
	 */
	deleteSingleRun(runId: string, disableMessage?: string) {
		// Exit if we have a disableMessage
		if (disableMessage) {
			CustomAlert.alert(disableMessage)
			return
		}

		let runNumber = -1		
		try {
			runNumber = Number(runId.split('-')[1])
		} catch(err) {
			console.log('Invalid runId passed to deleteSingleRun\n', err)
			console.error('Invalid runId passed to deleteSingleRun\n', err)
		}
		
		const runList = {...this.getRunList()}
		const selectedBotId = this.selectedBotId()
		const warningString = runId ? `Are you sure you want to delete Run: ${runNumber}` : `Are you sure you want to delete this run for bot: ${selectedBotId}`
	
		CustomAlert.confirm(warningString, 'Delete Run', () => {
			const run = runList.runs[runId]
			delete runList?.runs[runId]
			delete runList?.botsAssignedToRuns[run.assigned]
			if (this.state.visiblePanel === 'GOAL_SETTINGS') {
				this.setVisiblePanel(PanelType.NONE)
				this.setMoveWptMode(false, `run-${this.state.goalBeingEdited?.runNumber}`, this.state.goalBeingEdited?.goalIndex)
			}
			this.setRunList(runList)
			this.updateMissionHistory(runList)
		})
	}

	generateDeleteAllRunsWarnStr(rallyPointRun?: boolean) {
			if (rallyPointRun) {
				return 'Proceeding with this action will move all bots towards the selected rally point, deleting their current missions.' 
			}
			return 'Are you sure you want to delete all runs in this mission?'
	}
	// 
	// Delete Mission (End)
	// 

	// 
	// Load + Save Missions (Start)
	//
	/**
	 * Save a mission from LocalStorage into the JCC
	 * 
	 * @param {MissionInterface} missionToLoad Mission data to be moved to JCC
	 * @return {void}
	 */
	loadMissions(missionToLoad: MissionInterface) {
		const runList = this.getRunList()

		this.deleteAllRunsInMission(runList, false).then((confirmed: boolean) => {
			if (confirmed) {
				for (let run in missionToLoad?.runs) {
					// Mutates runList
					Missions.addRunWithCommand(-1, missionToLoad.runs[run].command, runList)
				}
				// Sets state with the most up to date runList
				this.setRunList(runList)
				this.updateMissionHistory(runList)
			}
		})
	}

	/**
	 * Opens load mission panel
	 * 
	 * @return {void}
	 */
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
				areThereRuns={() => this.areThereRuns()}
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
			const isSelected = (assignedBot === selectedBotId) || run.id === missions.runIdInEditMode
			const activeGoalIndex = podStatus?.bots?.[assignedBot]?.active_goal
			const isEdit = this.getRunList().runIdInEditMode === run.id

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
					isEdit,
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

	getWaypointFeatures(missions: MissionInterface, podStatus?: PodStatus, selectedBotId?: number) {
		const features: OlFeature[] = []
		let zIndex = 2

		for (let key in missions?.runs) {
			const run = missions?.runs[key]
			const assignedBot = run.assigned
			const isSelected = (assignedBot === selectedBotId) || run.id === missions.runIdInEditMode
			const activeGoalIndex = podStatus?.bots?.[assignedBot]?.active_goal
			const isEdit = this.getRunList().runIdInEditMode === run.id

			// Add our goals
			const plan = run.command?.plan
			if (plan) {
				const runNumber = run.id.slice(4)

				const newFeatures = (plan.goal ?? []).map((goal, goalIndex) => {
					return new Feature({
						geometry: new Point(getMapCoordinate(goal.location, map)),
						goal: goal,
						isActive: activeGoalIndex == goalIndex + 1,
						isSelected: isSelected,
						canEdit: isEdit,
						zIndex: zIndex
					})
				})

				features.push(...newFeatures)
				zIndex += 1
			}
		}

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
		const missionSource = layers.missionLayerSource
		const missionFeatures = this.getMissionFeatures(this.getRunList(), this.getPodStatus(), this.selectedBotId())
		missionSource.clear()
		missionSource.addFeatures(missionFeatures)

		const waypointCircleSource = layers.waypointCircleLayer.getSource()
		waypointCircleSource.clear()
		waypointCircleSource.addFeatures(this.getWaypointFeatures(this.getRunList(), this.getPodStatus(), this.selectedBotId()))
	}

	
	/**
	 * Updates the circles denoting the comms limit for each hub
	 */
	updateHubCommsCircles() {
		const hubs = Object.values(this.state.podStatus.hubs)

		const source = layers.hubCommsLimitCirclesLayer.getSource()
		let features = []
		source.clear()

		for (const hub of hubs) {
			if (hub?.location) {
				const feature = new Feature(new Point(getMapCoordinate(hub?.location, map)))
				feature.set('hub', hub)
				features.push(feature)
			}
		}

		source.addFeatures(features)
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
			const inEdit = false
			if (activeMissionPlan != null) {
				let features = MissionFeatures.createMissionFeatures(
					map, 
					bot,
					activeMissionPlan,
					bot.active_goal,
					this.isBotSelected(Number(botId)),
					inEdit
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
	 * Update the map view based on Optimize Mission Planning inputs
	 * 
	 * @returns {void}
	 */
	updateMissionPlanningLayer() {
		const surveyMissionColor = '#051d61'
		const surveyPlanLineStyle = new OlStyle({
			fill: new OlFillStyle({color: surveyMissionColor}),
			stroke: new OlStrokeStyle({color: surveyMissionColor, width: 1.0}),
		})

		// Place all the mission planning features in this for the missionLayer
		const missionPlanningFeaturesList: OlFeature[] = []
		const { missionPlanningGrid, missionBaseGoal, missionStartTask, missionEndTask } = this.state


		if (missionPlanningGrid) {
			this.missionPlans = getSurveyMissionPlans(
				this.state.startRally?.get('location'),
				this.state.endRally?.get('location'), 
				missionPlanningGrid,
				missionBaseGoal,
				missionStartTask, 
				missionEndTask
			)
			const planningGridFeatures = featuresFromMissionPlanningGrid(missionPlanningGrid, missionBaseGoal)
			missionPlanningFeaturesList.push(...planningGridFeatures)
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
				mpFeature.setStyle(surveyStyle(mpFeature, this.state.missionBaseGoal.task?.type))
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

	/**
	 * Add a waypoint to the OpenLayers map for a given tap/click
	 * 
	 * @param {GeographicCoordinate} location Where the waypoint should be added
	 * @returns {void}
	 */
	addWaypointAt(location: GeographicCoordinate) {
		let botId = this.selectedBotId()
		let runList = this.getRunList()

		if (!botId && runList.runIdInEditMode === '') {
			return
		}

		const runs = runList?.runs
		const botsAssignedToRuns = runList?.botsAssignedToRuns

		if (botId && !(botId in botsAssignedToRuns)) {
			runList = Missions.addRunWithWaypoints(botId, [], runList)
		}

		// Attempted to create a run greater than MAX_RUNS
		// The check for MAX_RUNS occurs in Missions.tsx
		if (!runList) { return }

		if (botId && !runs[botsAssignedToRuns[botId]]?.command) {
			runs[botsAssignedToRuns[botId]].command = Missions.commandWithWaypoints(botId, []);
		}

		let run = null
		if (!botId) {
			run = runs[this.getRunList().runIdInEditMode]
		} else {
			run = runs[botsAssignedToRuns[botId]]
		}

		// Prevent error after operator deletes an unassigned run and then clicks on the map
		if (!run) { return }
		
		if (run.id !== this.getRunList().runIdInEditMode) {
			warning('Run cannot be modified: toggle Edit in the Mission Panel, Bot Details Panel, or delete the run')
			return
		}

		if (run.command.plan.goal.length < MAX_GOALS) {
			run.command.plan.goal.push({location: location})	
		} else {
			warning("Adding this goal exceeds the limit of "+ MAX_GOALS +"!");
		}

		this.setRunList(runList)
		this.updateMissionHistory(runList)
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

	/**
	 * Click handler for JCC map
	 * 
	 * @param {MapBrowserEvent<UIEvent>} evt stores data on where the click occured
	 * @returns {void}
	 * 
	 * @notes
	 * /refactor >> figure out what was clicked on, then pass to the correct secondary handler to
	 *              break up this function
	 */
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
			// Allow an operator to click on certain features while edit mode is off
			const editModeExemptions = ['dive', 'drift', 'rallyPoint', 'bot', 'hub', 'wpt', 'line']
			const isCollection = feature.get('features')

			if (editModeExemptions.includes(feature?.get('type')) || isCollection || this.state.visiblePanel === 'MEASURE_TOOL') {
				// Operator is free to click on this feature while Edit Mode is off
			} else {
				const runList = this.state.runList
				const isInEditMode = `run-${feature?.get('runNumber') }` === runList.runIdInEditMode
				if (!isInEditMode) {
					warning('Run cannot be modified: toggle Edit in the Mission Panel, Bot Details Panel, or delete the run')
					return false
				}
			}

			// Clicked on goal / waypoint
			const goal = feature.get('goal')
			if (goal) {
				const goalBeingEdited = {
					goal: goal,
					originalGoal: deepcopy(goal),
					goalIndex: feature.get('goalIndex'),
					botId: feature.get('botId'),
					runNumber: feature.get('runNumber')
				}
				this.setState({ goalBeingEdited }, () => this.setVisiblePanel(PanelType.GOAL_SETTINGS))
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
				}

				this.setState({ flagClickedInfo }, () => {
					this.setVisiblePanel(PanelType.RUN_INFO)	
				})

				return false
			}

			// Clicked on line between waypoints
			const isLine = feature.get('type') === 'line'
			if (isLine) {
				return
			}

			// Clicked on rally point
			const isRallyPoint = feature.get('type') === 'rallyPoint'
			if (isRallyPoint) {
				this.setState({ selectedRallyFeature: feature }, () => this.setVisiblePanel(PanelType.RALLY_POINT))
				return
			}

			// Clicked on dive task packet
			const isDivePacket = isCollection && isCollection.length === 1 && feature.get('features')[0].get('type') === 'dive'
			if (isDivePacket) {
				if (this.state.selectedTaskPacketFeature) {
					this.unselectAllTaskPackets()
				}

				const diveFeature = feature.get('features')[0]
				const startTime = new Date(diveFeature.get('startTime') / 1000)
				const endTime = new Date(diveFeature.get('endTime') / 1000)
				const taskPacketData = {
					// Snake case used for string parsing in task packet panel
					bot_id: {value: diveFeature.get('botId'), units: ''},
					depth_achieved: {value: diveFeature.get('depthAchieved'), units: 'm'},
					dive_rate: {value: diveFeature.get('diveRate'), units: 'm/s'},
					bottom_dive: {value: diveFeature.get('bottomDive') ? 'Yes': 'No', units: ''},
					start_time: {value: startTime.toLocaleString(), units: ''},
					end_time: {value: endTime.toLocaleString(), units: ''}
				}

				this.setTaskPacketInterval(diveFeature, 'dive')

				this.setState({
					taskPacketType: diveFeature.get('type'),
					taskPacketData: taskPacketData
				}, () => this.setVisiblePanel(PanelType.TASK_PACKET))
				return
			}

			// Clicked on drift task packet
			const isDriftPacket = isCollection && isCollection.length === 1 && feature.get('features')[0].get('type') === 'drift'
			if (isDriftPacket) {
				if (this.state.selectedTaskPacketFeature) {
					this.unselectAllTaskPackets()
				}

				const driftFeature = feature.get('features')[0]				
				const startTime = new Date(driftFeature.get('startTime') / 1000)
				const endTime = new Date(driftFeature.get('endTime') / 1000)
				const taskPacketData = {
					// Snake case used for string parsing in task packet panel
					bot_id: {value: driftFeature.get('botId'), units: ''},
					duration: {value: driftFeature.get('duration'), units: 's'},
					speed: {value: driftFeature.get('speed'), units: 'm/s'},
					drift_direction: {value: driftFeature.get('driftDirection'), units: 'deg'},
					sig_wave_height_beta: {value: driftFeature.get('sigWaveHeight'), units: 'm'},
					start_time: {value: startTime.toLocaleString(), units: ''},
					end_time: {value: endTime.toLocaleString(), units: ''}
				}

				this.setTaskPacketInterval(driftFeature, 'drfit')

				this.setState({
					taskPacketType: driftFeature.get('type'),
					taskPacketData: taskPacketData
				}, () => this.setVisiblePanel(PanelType.TASK_PACKET))
				return
			}

			// Clicked on cluster
			if (isCollection  && isCollection.length > 1 ) {
				const extent = boundingExtent(
					isCollection.map((r: any) => r?.getGeometry()?.getCoordinates())
				  );
				if (extent) {
					map.getView().fit(extent, {duration: 1000, padding: [50, 50, 50, 50]});
				}
				
				return
			}
		}
		
		if (this.state.goalBeingEdited) {
			const didWaypointMove = this.clickToMoveWaypoint(evt)
			if (didWaypointMove) { return }
		}

		if (this.state.visiblePanel === 'MEASURE_TOOL') {
			return
		}

		this.addWaypointAtCoordinate(evt.coordinate)
	}
	// 
	// Transferring Mission to GUI (End)
	//

	// 
	// Bot Edit Mode (Start)
	//
	toggleEditMode(evt: React.ChangeEvent<HTMLInputElement>, run: RunInterface) {
		const runList = this.getRunList()
		if (evt.target.checked) {
			runList.runIdInEditMode = run?.id
		} else {
			if (this.state.visiblePanel === 'GOAL_SETTINGS') {
				this.setVisiblePanel(PanelType.GOAL_SETTINGS)
				this.setMoveWptMode(false, `run-${this.state.goalBeingEdited?.runNumber}`, this.state.goalBeingEdited?.goalIndex)
			}
			runList.runIdInEditMode = ''
		}
		this.setRunList(runList)
    }

	setMoveWptMode(canMoveWpt: boolean, runId: string, goalNum: number) {
		let run: RunInterface = null
		for (let testRun of Object.values(this.getRunList().runs)) {
			if (testRun.id === runId) {
				run = testRun
				break
			}
		}

		if (run?.command.plan?.goal[goalNum - 1]) {
			run.command.plan.goal[goalNum - 1].moveWptMode = canMoveWpt
		}

		const goalBeingEdited = this.state.goalBeingEdited
		if (goalBeingEdited) {
			goalBeingEdited.moveWptMode = canMoveWpt
		}
		this.setState({ goalBeingEdited })
	}

	/**
	 * Moves a waypoint from its existing location to a new location selected by the operator
	 * 
	 * @param {MapBrowserEvent<UIEvent>} evt Holds the new location for the waypoint
	 * @returns {boolean} Whether or not the waypoint moved
	 */
	clickToMoveWaypoint(evt: MapBrowserEvent<UIEvent>) {
		const goalNum = this.state.goalBeingEdited?.goalIndex
		const geoCoordinate = getGeographicCoordinate(evt.coordinate, map)
		let runList = {...this.state.runList}
		let runs = runList.runs
		const runId = `run-${this.state.goalBeingEdited?.runNumber}`
		let run = runs[runId]

		if (this.state.goalBeingEdited?.moveWptMode && run) {
			run.command.plan.goal[goalNum -1].location = geoCoordinate
			this.setRunList(runList)
			this.updateMissionHistory(runList)
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
		const rallyNum = this.getRallyNumber()

		rallyFeature.setProperties({ 
			'type': 'rallyPoint', 
			'num': rallyNum,
			'id': Math.random(),
			'location': getGeographicCoordinate(coordinate, map),
			'disableDrag': true
		})
		rallyFeature.setStyle(getRallyStyle(rallyNum))
		
		layers.rallyPointLayer.getSource().addFeature(rallyFeature)

		if (!this.state.startRally) {
			// Start rally number will always be lower than end rally unless operator manually assigns
			this.setState({ startRally: rallyFeature })
		} else if (!this.state.endRally) {
			// To prevent operator confusion, prevent auto-assign from setting an end rally with a smaller number than the start rally
			if (rallyFeature.get('num') > this.state.startRally.get('num')) {
				this.setState({ endRally: rallyFeature })
			}
		}
	}

	getRallyNumber() {
		let rallyNum = 0
		if (this.state.reusableRallyNums.length > 0) {
			// Sorted least to greatest
			const reusableRallyNums = this.state.reusableRallyNums
			rallyNum = reusableRallyNums[0]
			reusableRallyNums.splice(0, 1)
			this.setState({ reusableRallyNums })
		} else {
			rallyNum = this.state.rallyCounter
			this.setState({ rallyCounter: this.state.rallyCounter + 1 })
		}
		return rallyNum
	}

	/**
	 * Sends all bots to the targeted rally point
	 * 
	 * @param {OlFeature<Point>} rallyFeature Holds the location of the targeted rally
	 * @returns {void}
	 */
	goToRallyPoint(rallyFeature: OlFeature<Point>) {
		const location = rallyFeature.get('location')
		let addRuns: CommandList = {}

		for (let bot in this.getPodStatus().bots) {
			addRuns[Number(bot)] = Missions.commandWithWaypoints(Number(bot), [location]);
		}

		let runList = this.getRunList()
		this.runMissions(runList, addRuns)
		runList.runIdInEditMode = ''
		this.setRunList(runList)
		this.updateMissionHistory(runList)
		this.setVisiblePanel(PanelType.NONE)
	}

	deleteRallyPoint(rallyFeature: OlFeature) {
		layers.rallyPointLayer.getSource().removeFeature(rallyFeature)

		const reusableRallyNums = this.state.reusableRallyNums
		reusableRallyNums.push(rallyFeature.get('num'))
		reusableRallyNums.sort()
		this.setState({ reusableRallyNums })

		this.assignRallyPointsAfterDelete(rallyFeature)

		this.setVisiblePanel(PanelType.NONE)
	}

	assignRallyPointsAfterDelete(rallyFeature: OlFeature) {
		let rallyFeatures = layers.rallyPointLayer.getSource().getFeatures()
		// Sort in ascending order
		rallyFeatures.sort((a, b) => a.get('num') - b.get('num'))

		// Check if deleted rally feature was start rally
		if (rallyFeature.get('id') === this.state.startRally?.get('id')) {
			let newStartRally = null
			if (rallyFeatures.length >= 2) {
				// Assign start rally to lowest number (if end rally is the lowest, set start to the next highest)
				newStartRally = (
					rallyFeatures[0] === this.state.endRally ? rallyFeatures[1] : rallyFeatures[0]
				)
			}
			this.setState({ startRally: newStartRally })
		}

		// Check if deleted rally feature was end rally
		if (rallyFeature.get('id') === this.state.endRally?.get('id')) {
			let newEndRally = null
			//  Find start rally, then make end rally equal to start rally + 1
			for (let i = 0; i < rallyFeatures.length; i++) {
				if (rallyFeatures[i].get('id') === this.state?.startRally.get('id') && i + 1 < rallyFeatures.length) {
					newEndRally = rallyFeatures[i + 1]
					this.setState({ endRally: newEndRally })
					return
				}
			}

			// If end rally was not set, then start rally is the highest rally point, so get one less
			if (!newEndRally && rallyFeatures.length >= 2) {
				newEndRally = rallyFeatures[rallyFeatures.length - 2]
				this.setState({ endRally: newEndRally })
			} else {
				this.setState({ endRally: newEndRally })
			}
		}
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
			feature.setStyle(styleFunction(feature, 'white'))
		} else {
			feature.setStyle(styleFunction(feature, 'black'))
		}
		feature.set('animated', !feature.get('animated'))
	}

	unselectTaskPacket(type: string) {
		const features = type === 'dive' ? taskData.divePacketLayer.getSource().getFeatures() : taskData.driftPacketLayer.getSource().getFeatures()
		for (const featuresArray of features) {
			const feature = featuresArray.get('features')[0]
			if (feature.get('selected')) {
				feature.set('selected', false)
				// Reset style
				const styleFunction = type === 'dive' ? divePacketIconStyle : driftPacketIconStyle
				feature.setStyle(styleFunction(feature, 'white'))
			}
		}
		clearInterval(this.state.taskPacketIntervalId)
		this.setState({ selectedTaskPacketFeature: null })
	}

	unselectAllTaskPackets() {
		this.unselectTaskPacket('dive')
		this.unselectTaskPacket('drift')
	}

	setTaskPacketInterval(selectedFeature: Feature, type: string) {
		const taskPacketFeatures = type === 'dive' ? taskData.divePacketLayer.getSource().getFeatures() : taskData.driftPacketLayer.getSource().getFeatures()
		const styleFunction = type === 'dive' ? divePacketIconStyle : driftPacketIconStyle
		for (const taskPacketFeature of taskPacketFeatures) {
			if (taskPacketFeature.get('features')[0].get('id') === selectedFeature.get('id')) {
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

	setClusterModeStatus(isOn: boolean) {
		this.setState({ isClusterModeOn: isOn })
	}

	/**
	 * Called when operator toggles "Edit Dates" in Settings panel >> Task Packets accordion
	 * 
	 * @returns {void}
	 */
	handleTaskPacketEditDatesToggle() {
		let taskPacketsTimeline = {...this.state.taskPacketsTimeline}
		// Reset TaskPackets to default time gap
		if (taskPacketsTimeline.isEditing) {
			this.api.getTaskPackets().then((taskPackets) => {
				this.setTaskPackets(taskPackets)
				taskData.updateTaskPacketsLayers(taskPackets)
			}).catch((err) => {
				console.error('Task Packets Retrieval Error:', err)
			})
			this.resetTaskPacketsTimeline(false)
		} else {
			// Trigger the calendar view to open
			taskPacketsTimeline.isEditing = true
			this.setState({ taskPacketsTimeline })
		}
	}

	/**
	 * Save changes made by an operator to the TaskPackets date/time calendar
	 * 
	 * @param {React.ChangeEvent<HTMLInputElement>} evt holds which date/time input changed 
	 * @returns {void}
	 */
	handleTaskPacketsTimelineChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
		let taskPacketsTimeline = {...this.state.taskPacketsTimeline}
		switch(evt.target.id) {
			case 'task-packet-start-date':
				taskPacketsTimeline.startDate = evt.target.value
                break
            case 'task-packet-start-time':
				taskPacketsTimeline.startTime = evt.target.value
                break
            case 'task-packet-end-date':
				taskPacketsTimeline.endDate = evt.target.value
                break
            case 'task-packet-end-time':
				taskPacketsTimeline.endTime = evt.target.value
                break
        }
		this.setState({ taskPacketsTimeline })
    }

	handleSubmitTaskPacketsTimeline() {
		if (this.isTaskPacketsSendBtnDisabled()) {
			warning('Start date cannot be ahead of end date')
			return
		}
		let taskPacketsTimeline = {...this.state.taskPacketsTimeline}
		taskPacketsTimeline.start = (
			`${taskPacketsTimeline.startDate} ${taskPacketsTimeline.startTime}` // yyyy-mm-dd
		)
		taskPacketsTimeline.end = (
			`${taskPacketsTimeline.endDate} ${taskPacketsTimeline.endTime}` // yyyy-mm-dd
		)

		let end = ''

		// 'Keep End Date Current' checkbox is not checked
		if (!this.state.taskPacketsTimeline.keepEndDateCurrent) {
			end = taskPacketsTimeline.end as string
		}

		this.api.getTaskPackets(
			taskPacketsTimeline.start as string,
			end
		).then((taskPackets) => {
			this.setTaskPackets(taskPackets)
			taskData.updateTaskPacketsLayers(taskPackets)
			success('Getting Task Packets...')
		}).catch((err) => {
			console.error('Task Packets Timeline Submission Error:', err)
		 })

		this.setState({ taskPacketsTimeline })
	}

	/**
	 * Adjust end date/time in TaskPackets calendar when "Keep End Date Current" checkbox changes
	 *  
	 * @returns {void}
	 */
	handleKeepEndDateCurrentToggle() {
		let taskPacketsTimeline = {...this.state.taskPacketsTimeline}
		// Checkbox goes from unchecked to checked
		// Keep start but reset end to now (by passing no argument for endDate)
		if (!taskPacketsTimeline.keepEndDateCurrent) {
			this.api.getTaskPackets(taskPacketsTimeline.start as string).then((taskPackets) => {
				this.setTaskPackets(taskPackets)
				taskData.updateTaskPacketsLayers(taskPackets)
				this.resetTaskPacketsTimeline(true)
			}).catch((err) => {
				console.error('Task Packets Retrieval Error:', err)
			})
		} else {
			// Uncheck the checkbox
			taskPacketsTimeline.keepEndDateCurrent = false
			this.setState({ taskPacketsTimeline })
		}
	}

	isTaskPacketsSendBtnDisabled() {
		// Check that start date/time is not ahead of end date/time
		const taskPacketsTimeline = this.state.taskPacketsTimeline
		if (
			(taskPacketsTimeline.startTime > taskPacketsTimeline.endTime 
			&& taskPacketsTimeline.startDate >= taskPacketsTimeline.endDate)
			|| taskPacketsTimeline.startDate > taskPacketsTimeline.endDate
			|| (taskPacketsTimeline.startDate === '' || taskPacketsTimeline.startTime === '')
		) {
			return true
		}
		return false
    }

	/**
	 * Set TaskPackets view to default start/end gap with the end date/time set to now
	 * 
	 * @param {boolean} isEditing determines if the Task Packets >> Edit Dates view should be open
	 * @returns {void}
	 */
	resetTaskPacketsTimeline(isEditing: boolean) {
		// Make update before the next poll occurs
		let forceDateChange = {start: true, end: true}
		if (isEditing) {
			forceDateChange.start = false
		}
		let updatedTaskPacketsTimeline = this.setTaskPacketDates(forceDateChange)
		updatedTaskPacketsTimeline.isEditing = isEditing
		updatedTaskPacketsTimeline.keepEndDateCurrent = true
		this.setState({ taskPacketsTimeline: updatedTaskPacketsTimeline })
	}

	getTaskPackets() {
		return this.taskPackets
	}

	setTaskPackets(taskPackets: TaskPacket[]) {
		this.taskPackets = taskPackets
	}

	getTaskPacketsCount() {
		return this.taskPacketsCount
	}

	setTaskPacketsCount(count: number) {
		this.taskPacketsCount = count
	}

	/**
	 * Update the TaskPacket date values held in state
	 * 
	 * @param {{start: booleaan, end: boolean}} forceDateChange change the calendar display before next poll completes
	 * @returns {{[x: string]: string | boolean} | null} provides newest copy of taskPacketsTimeline for when state calls compete
	 */
	setTaskPacketDates(forceDateChange?: {[type: string]: boolean}) {
		let taskPacketsTimeline = {...this.state.taskPacketsTimeline}
		
		// Operator does not want the dates they set to change
		if (
			taskPacketsTimeline.isEditing 
			&& !taskPacketsTimeline.keepEndDateCurrent
			&& !forceDateChange
		) { return null }

		// Make end date current
		const endDate = new Date()
		taskPacketsTimeline.endDate = getHTMLDateString(endDate)
		taskPacketsTimeline.endTime = getHTMLTimeString(endDate)
		taskPacketsTimeline.end = `${taskPacketsTimeline.endDate} ${taskPacketsTimeline.endTime}`

		// Make start date current
		if (!taskPacketsTimeline.isEditing || forceDateChange?.start) {
			let startDate = new Date()
			const defaultTimeGap = 14
			startDate.setHours(endDate.getHours() - defaultTimeGap)
			taskPacketsTimeline.startDate = getHTMLDateString(startDate)
			taskPacketsTimeline.startTime = getHTMLTimeString(startDate)
			taskPacketsTimeline.start = `${taskPacketsTimeline.startDate} ${taskPacketsTimeline.startTime}`
		}

		this.setState({ taskPacketsTimeline })
		return taskPacketsTimeline
	}
	// 
	// Task Packets (End)
	// 

	// 
	// RC Mode (Start)
	// 
	isRCModeActive(botId: number) {
		return this.state.rcModeStatus[botId]
	}

	/**
	 * This handles setting the RC mode so that it ends up in a clean state
	 * 
	 * @param {number} botId The id used to map the RC mode to a specific bot 
	 * @param {boolean} rcMode Whether or not the bot is in RC
	 * @returns {void} 
	 */
	setRcMode(botId: number, rcMode: boolean) {
		if (botId === -1) {
			return
		}

		// Clear interval before we set rc mode
		this.clearRemoteControlInterval()

		const rcModeStatus = this.state.rcModeStatus
		rcModeStatus[botId] = rcMode
		this.setState({ rcModeStatus })

		const botFeature = this.botLayers.layers[botId].getSource().getFeatures()[0]
		botFeature.setProperties({ 'rcMode': rcMode })
	}

	createRemoteControlInterval() {
		this.clearRemoteControlInterval()

		this.state.remoteControlInterval = setInterval(() => {
				this.api.postEngineeringPanel(this.state.remoteControlValues);
			}, 500)
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
			CustomAlert.confirm(warningString, 'Use (0, 0) Datum', () => {
				datumLocation = {lat: 0, lon: 0}
			})
		}
	}

	/**
	 * Used to initialize the RC dive parameters in state
	 * 
	 * @param {number} botId Used to find the bot's dive parameters
	 * @returns {void}
	 */
	initRCDivesParams(botId: number) {
		if (botId !== undefined) {
			let newRCDives = cloneDeep(this.state.rcDives)
				newRCDives[botId] = {
				maxDepth: '10',
				depthInterval: '10',
				holdTime: '0',
				driftTime: '10'
			}
			this.setState({ rcDives: newRCDives })
		}
	}

	setRCDiveParams(diveParams: {[param: string]: string}) {
		let newRCDives = cloneDeep(this.state.rcDives)
		newRCDives[this.selectedBotId()].maxDepth = diveParams.maxDepth
		newRCDives[this.selectedBotId()].depthInterval = diveParams.depthInterval
		newRCDives[this.selectedBotId()].holdTime = diveParams.holdTime
		newRCDives[this.selectedBotId()].driftTime = diveParams.driftTime
		this.setState({ rcDives: newRCDives })
	}
	// 
	// RC Mode (End)
	//

	//
	// Download Queue (Start)
	//
	/**
	 * Triggers the download of all ready bots when the Downlaod All button is pressed
	 * 
	 * @returns {void}
	 */
	async processDownloadAllBots() {
		this.takeControl(() => {

			const commDest = this.determineAllCommandBots(false, false, false, true)
			const downloadableBots = this.getDownloadableBots()
			const downloadableBotIds = downloadableBots.map((bot) => bot.bot_id)

			if (downloadableBotIds.length === 0) {
				CustomAlert.alert(
					commDest.downloadQueueMessage
					+ commDest.botIdsDownloadNotAvailable
					+ commDest.disconnectedMessage
				)
				return
			}

			const confirmText = `Would you like to do a data download for Bot${commDest.botIds.length > 1 ? 's': ''}:  ${commDest.botIds}` + 
				commDest.downloadQueueMessage + commDest.disconnectedMessage;

			CustomAlert.confirm(confirmText, 'Data Download', () => {
				const queue = this.state.botDownloadQueue
				const updatedQueue = queue.concat(downloadableBots)
				this.setState({ botDownloadQueue: updatedQueue }, () => this.downloadBotsInOrder())
				info('Open the Download Panel to see the bot download queue')
			})
		})
	}

	async processDownloadSingleBot(bot: PortalBotStatus, disableMessage: string) {
		this.takeControl(() => {
		
			// Exit if we have a disableMessage
			if (disableMessage !== "") {
				CustomAlert.alert(disableMessage)
				return
			}

			CustomAlert.confirm(`Would you like to do a data download for Bot ${bot.bot_id}?`, 'Data Download', () => {
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
			})
		})
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

		const doRemoveBotFromQueue = () => {
			const queue = this.state.botDownloadQueue
			const updatedQueue = queue.filter((queuedBot) => {
				if (!(queuedBot.bot_id === bot.bot_id)) {
					return queuedBot
				}
			})
	
			this.setState({ botDownloadQueue: updatedQueue }, () => this.downloadBotsInOrder())
		}

        if (downloadStates.includes(this.getBotMissionState(bot.bot_id))) {
			CustomAlert.confirm('Removing this bot will not cancel the download, but it will allow the other bots to move up in the queue. You may experience slower download speeds. Are you sure?', 'Remove Bot From Queue', doRemoveBotFromQueue)
        }
		else {
			doRemoveBotFromQueue()
		}
	}

	getDownloadableBots() {
		const commDest = this.determineAllCommandBots(false, false, false, true)

		const downloadableBots: PortalBotStatus[] = []
		const bots = this.getPodStatus().bots
		for (const bot of Object.values(bots)) {
			for (const enabledState of this.enabledDownloadStates) {
				if (bot?.mission_state.includes(enabledState) && 
					bot?.wifi_link_quality_percentage && 
					!this.isBotInQueue(bot) &&
					!commDest.botIdsDisconnected.includes(bot?.bot_id)) {
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
	/**
	 * Toolbar located at the top of the JCC
	 * 
	 * @returns {void}
	 * 
	 * @notes
	 * /refactor >> this should be its own separate component
	 */
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
				{(this.state.visiblePanel == PanelType.DOWNLOAD_QUEUE ? (
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
				))}
				<Button id="undo" className="button-jcc" onClick={() => this.handleUndoClick()}>
					<Icon path={mdiArrowULeftTop} title="Undo"/>
				</Button>
				{(this.state.visiblePanel == PanelType.SETTINGS ? (
				<Button className="button-jcc active" onClick={() => {
					this.setVisiblePanel(PanelType.NONE)
					}}
				>
					<Icon path={mdiCog} title="Settings"/>
				</Button>
				) : (
					<Button className="button-jcc" onClick={() => {
						this.setVisiblePanel(PanelType.SETTINGS)
						}}
					>
						<Icon path={mdiCog} title="Settings"/>
					</Button>
				))}
				<Button className={'button-jcc' + (this.state.isHelpWindowDisplayed ? ' active' : '')} onClick={() => {this.setState({isHelpWindowDisplayed: !this.state.isHelpWindowDisplayed})}}>
					<Icon path={mdiHelp} title="Help"></Icon>
				</Button>
				<img className="jaia-logo button" src="/favicon.png" onClick={() => {
						const jaiaInfoContainer = document.getElementById('jaia-about-container') as HTMLElement
				 		jaiaInfoContainer.style.display = "grid"
					}}>
				</img>
			</div>
		)

		return element
	}

	/**
	 * This is a helper function for determining which bots to send an all command to
	 * @param sendingMission determines output and bot bots to send the mission command to
	 * @param sendingActivate determines output and bot bots to send the acivate command to
	 * @param sendingStop determines output and bot bots to send the stop command to
	 * @param sendingDownload determines output and bot bots to send the download command to
	 * @returns The information needed to determin what bots to send the all command to (BotAllCommandInfo interface)
	 */
	determineAllCommandBots(sendingMission: boolean, sendingActivate: boolean, sendingStop: boolean, sendingDownload: boolean) {
		let botInfo: BotAllCommandInfo
		let stopAvailable: RegExp = /^IN_MISSION__.+$/
		let stopNotAvailable: RegExp = /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/
		let idleStates: RegExp = /^.+__IDLE$/
		let failedState: RegExp = /^PRE_DEPLOYMENT__FAILED$/
		let healthError: RegExp = /^HEALTH__FAILED$/

		botInfo = {
			botIds: [],
			botIdsInIdleState: [],
			botIdsNotInIdleState: [],
			botIdsInStoppedState: [],
			botIdsPoorHealth: [],
			botIdsDisconnected: [],
			botIdsDownloadNotAvailable: [],
			botIdsInDownloadQueue: this.state.botDownloadQueue.map((bot) => bot.bot_id),
			botIdsWifiDisconnected: [],
			idleStateMessage:  "",
			notIdleStateMessage: "",
			stoppedStateMessage: "",
			poorHealthMessage: "",
			downloadQueueMessage:  "",
			disconnectedMessage: ""
		}

		for (const bot of Object.values(this.getPodStatus().bots)) {
			let notAvailable = true
			if (sendingDownload) {
				for (const enabledState of this.enabledDownloadStates) {
					if (bot?.mission_state.includes(enabledState)) {
						notAvailable = false
						break;
					}
				}
				if (notAvailable) {
					botInfo.botIdsDownloadNotAvailable.push(bot.bot_id)
				}
			}

			if (sendingMission && (idleStates.test(bot?.mission_state) || failedState.test(bot?.mission_state))) {
				botInfo.botIdsInIdleState.push(bot?.bot_id)
			} else if (sendingActivate && (!idleStates.test(bot?.mission_state) && !failedState.test(bot?.mission_state))) {
				botInfo.botIdsNotInIdleState.push(bot?.bot_id)
			} else if (sendingStop && (!stopAvailable.test(bot?.mission_state) || stopNotAvailable.test(bot?.mission_state))) {
				botInfo.botIdsInStoppedState.push(bot?.bot_id)
			} else if (sendingMission && healthError.test(bot?.health_state)) {
				botInfo.botIdsPoorHealth.push(bot?.bot_id)
			} else if (botInfo.botIdsInDownloadQueue.includes(bot.bot_id)) {
				// Do not allow a bot in the download queue to start another run
			} else if (sendingDownload && notAvailable) {
				// Do not allow a bot in the incorrect state in the queue
			} else if (bot?.isDisconnected) {
				botInfo.botIdsDisconnected.push(bot?.bot_id)
		    } else if (sendingDownload && !bot?.wifi_link_quality_percentage) {
				botInfo.botIdsWifiDisconnected.push(bot?.bot_id)
			} else {
				botInfo.botIds.push(bot?.bot_id)
			}
		}

		botInfo.botIds.sort()
		botInfo.botIdsInIdleState.sort()
		botInfo.botIdsPoorHealth.sort()
		botInfo.botIdsDisconnected.sort()
		botInfo.botIdsNotInIdleState.sort()
		botInfo.botIdsInStoppedState.sort()

		if (botInfo.botIdsPoorHealth.length !==0) {
			botInfo.poorHealthMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsPoorHealth.length > 1 ? 's': ''}: ` + botInfo.botIdsPoorHealth + " because the health is poor"
		}
		if (botInfo.botIdsInIdleState.length !==0) {
			botInfo.idleStateMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsInIdleState.length > 1 ? 's': ''}: ` + botInfo.botIdsInIdleState + ` because ${botInfo.botIdsInIdleState.length > 1 ? 'they have': 'it has'} not been activated`
		}
		if (botInfo.botIdsNotInIdleState.length !==0) {
			botInfo.notIdleStateMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsNotInIdleState.length > 1 ? 's': ''}: ` + botInfo.botIdsNotInIdleState + ` because ${botInfo.botIdsNotInIdleState.length > 1 ? 'they have': 'it has'} been activated`
		}
		if (botInfo.botIdsInStoppedState.length !==0) {
			botInfo.stoppedStateMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsInStoppedState.length > 1 ? 's': ''}: ` + botInfo.botIdsInStoppedState + ` because ${botInfo.botIdsInStoppedState.length > 1 ? 'they have': 'it has'} been stopped`
		}
		if (botInfo.botIdsInDownloadQueue.length !==0) {
			botInfo.downloadQueueMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsInDownloadQueue.length > 1 ? 's': ''}: ` + botInfo.botIdsInDownloadQueue + ` because ${botInfo.botIdsInDownloadQueue.length > 1 ? 'they are': 'it is'} in the download queue`
		}
		if (botInfo.botIdsDownloadNotAvailable.length !==0) {
			botInfo.downloadQueueMessage += `\nThe command cannot be sent to Bot${botInfo.botIdsDownloadNotAvailable.length > 1 ? 's': ''}: ` + botInfo.botIdsDownloadNotAvailable + ` because ${botInfo.botIdsDownloadNotAvailable.length > 1 ? 'they need': 'it needs'} to be in one of these states: ${this.enabledDownloadStates}`
		}
		if (botInfo.botIdsDisconnected.length !==0) {
			botInfo.disconnectedMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsDisconnected.length > 1 ? 's': ''}: ` + botInfo.botIdsDisconnected + " because the status age is greater than 30"
		}
		if (botInfo.botIdsWifiDisconnected.length !==0) {
			botInfo.downloadQueueMessage = `\nThe command cannot be sent to Bot${botInfo.botIdsWifiDisconnected.length > 1 ? 's': ''}: ` + botInfo.botIdsWifiDisconnected + " the Wi-Fi Link Quality is poor (Check Quick Look in Bot Details)"
		}

		return botInfo
	}

	activateAllClicked(evt: UIEvent) {
		this.takeControl(() => {

			const commDest = this.determineAllCommandBots(false, true, false, false)

			if (commDest.botIds.length === 0) {
				CustomAlert.alert(commDest.notIdleStateMessage + commDest.downloadQueueMessage + commDest.disconnectedMessage)
			}
			else {
				let confirmationText = `Click the OK button to activate Bot${commDest.botIds.length > 1 ? 's': ''}: ${commDest.botIds} ` + 
					commDest.notIdleStateMessage + commDest.downloadQueueMessage + commDest.disconnectedMessage;

				CustomAlert.confirm(confirmationText, 'Activate Bots', () => {
					for (const botId of commDest.botIds) {
						let c = {
							bot_id: botId,
							type: CommandType.ACTIVATE
						}
				
						console.log(c)
						this.api.postCommand(c).then(response => {
							if (response.message) {
								error(response.message)
							}
						})
					}
				})
			}
		})
	}

	rallyButtonClicked() {
		// All panels with map clicking features that can interfere with setting a rally point
		const panelsToClose = [PanelType.MEASURE_TOOL, PanelType.MISSION_SETTINGS, PanelType.GOAL_SETTINGS]
		if (panelsToClose.includes(this.state.visiblePanel)) {
			this.setVisiblePanel(PanelType.NONE)
		}

		if (this.state.mode === 'newRallyPoint') {
			this.setState({ mode: '' })
			map.getTargetElement().style.cursor = 'default'
		} else {
			this.setState({ mode: 'newRallyPoint' })
			map.getTargetElement().style.cursor = 'crosshair'
		}
	}

	sendStopAll() {
		this.takeControl(() => {

			const commDest = this.determineAllCommandBots(false, false, true, false)

			if (commDest.botIds.length === 0) {
				CustomAlert.alert(commDest.stoppedStateMessage + commDest.downloadQueueMessage + commDest.disconnectedMessage)
			} else {
				CustomAlert.confirm(`Click the OK button to stop Bot${commDest.botIds.length > 1 ? 's': ''}: ${commDest.botIds} ` + 
				commDest.stoppedStateMessage + commDest.downloadQueueMessage + commDest.disconnectedMessage, 'Stop All Bots', () => {

					for (const botId of commDest.botIds) {
						let c = {
							bot_id: botId,
							type: CommandType.STOP
						}
				
						this.api.postCommand(c).then(response => {
							if (response.message) {
								error(response.message)
							}
							this.setRcMode(botId, false)
						})
					}
				})
			}
		})
	}

	playClicked(evt: UIEvent) {
		if (!this.areBotsAssignedToRuns()) {
			CustomAlert.alert('There are no runs assigned to bots yet.  Please assign one or more runs to one or more bots before you can run the mission.')
			return
		}

		this.runMissions(this.getRunList(), null);
	}

	recoverAllClicked(evt: UIEvent) {
		this.takeControl(() => {

			const commDest = this.determineAllCommandBots(false, false, false, false)

			CustomAlert.confirm(`Click the OK button to download data from Bot${commDest.botIds.length > 1 ? 's': ''}: ${commDest.botIds} ` + 
				commDest.downloadQueueMessage + commDest.disconnectedMessage, 'Download Data', () => {

				for (const botId of commDest.botIds) {
					let c = {
						bot_id: botId,
						type: CommandType.RECOVERED
					}
			
					console.log(c)
					this.api.postCommand(c).then(response => {
						if (response.message) {
							error(response.message)
						}
					})
				}
			})
		})
	}

	/**
	 * Restores the previous mission planning state by removing the last item from the history array
	 * and setting the displayed mission to the new last item of the history array
	 * 
	 * @returns {void}
	 * 
	 * @notes
	 * We passs the mission-to-display as a deepcopy to prevent the mission obj in the history
	 * array from being modified while acting as the displayed mission 
	 */
	handleUndoClick() {
		if (this.missionHistory.length === 1) {
			this.setRunList(deepcopy(this.missionHistory[0]))
			info('There is no more history to undo')
			return
		}

		this.missionHistory.pop()
		this.setRunList(deepcopy(this.missionHistory[this.missionHistory.length - 1]))

		// Close waypoint panel since it could apply to a waypoint that no longer exists
		if (this.state.visiblePanel === PanelType.GOAL_SETTINGS) {
			this.setState({ visiblePanel: PanelType.NONE })
		}
	}

	sendFlag(evt: UIEvent) {
		this.takeControl(() => {

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
		})
	}
	// 
	// Command Drawer (End)
	// 

	// 
	// Mission Contoroller Panel Helper Methods (Start)
	//
	/**
	 * Assign bots to runs in ascending order with one click
	 * 
	 * @returns {void}
	 */
	autoAssignBotsToRuns() {
        let podStatusBotIds = Object.keys(this.getPodStatus()?.bots)
        let botsAssignedToRunsIds = Object.keys(this.getRunList().botsAssignedToRuns)
        let botsNotAssigned: number[] = []
		let degradedStatusAge = 30
		
		// Find the difference between the current botIds available and the bots that are already assigned to get the ones that have not been assigned yet
        // Excludes any bot with status age > degradedStatusAge
		podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key) && this.getBotStatusAge(Number(key)) < degradedStatusAge) {
                let id = Number(key)
                if(isFinite(id)) {
                    botsNotAssigned.push(id)
                }
            }
        })

		const runList = this.getRunList()

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
	// Optimize Mission Planning Helper Methods (Start)
	//
	//
	/**
	 * Triggers a state update for changes made to the MissionParams
	 * 
	 * @param {MissionParams} params Contains the params edited by the operator
	 * @returns {void} 
	 */
	setMissionParams(params: MissionParams) {
		let updatedParams = {...params}
		this.setState({ missionParams: updatedParams })
	}

	/**
	 * Triggers a state update for changes made to the BottomDepthSafetyParams
	 * 
	 * @param {BottomDepthSafetyParams} params Contains the params edited by the operator
	 * @returns {void}
	 * 
	 * @notes
	 * Keeping the BottomDepthSafetyParams in CommandControl state allows the data to persist
	 * even when the panel closes leading to a smoother user experience
	 */
	setBottomDepthSafetyParams(params: BottomDepthSafetyParams) {
		const updatedParams = {...params}
		this.setState({ bottomDepthSafetyParams: updatedParams })
	}

	/**
	 * Adds SRP inputs from Optimize Mission Planning to each run
	 * 
	 * @returns {void}
	 */
	addSRPInputsToRuns() {
		const srpInputs = this.getValidSRPInputs()
		for (let runKey of Object.keys(this.state.runList.runs)) {
			let run = this.state.runList.runs[runKey]
			run.command.plan.bottomDepthSafetyParams = srpInputs
		}
	}

	/**
	 * Removes SRP inputs from each run
	 * 
	 * @returns {void}
	 */
	deleteSRPInputsFromRuns() {
		for (let runKey of Object.keys(this.state.runList.runs)) {
			let run = this.state.runList.runs[runKey]
			delete run.command.plan.bottomDepthSafetyParams
		}
	}

	/**
	 * Passes each SRP field through a check for containing characters or exceeding its max
	 * 
	 * @returns {BottomDepthSafetyParams} An updated copy of the SRP inputs
	 */
	getValidSRPInputs() {
		const maxDegrees = 360
		const maxSeconds = 360
		const maxSpeed = 3 // (m/s)
		const maxDepth = 60 // (m)

		let params = {...this.state.bottomDepthSafetyParams}

		params.constant_heading = this.checkSRPInputs(params.constant_heading, maxDegrees)
		params.constant_heading_time = this.checkSRPInputs(params.constant_heading_time, maxSeconds, true)
		params.constant_heading_speed = this.checkSRPInputs(params.constant_heading_speed, maxSpeed) 
		params.safety_depth = this.checkSRPInputs(params.safety_depth, maxDepth)

		this.setState({ bottomDepthSafetyParams: params })

		return params
	}

	/**
	 * Cleans input by removing characters and limiting it to an upper bound
	 * 
	 * @param {string} value Input to be checked
	 * @param {number} max Provides the upper bound for the value
	 * @param {boolean} removeDecimal (optional) Removes decimal if proto field expects ints
	 * @returns {string} The cleaned input
	 */
	checkSRPInputs(value: string, max: number, removeDecimal?: boolean) {
		if (Number.isNaN(Number(value))) {
			return "0"
		} else if (Number(value) > max) {
			return max.toString()
		}
		
		if (removeDecimal) {
			return Number(value).toFixed(0).toString()
		}
		return Number(value).toString()
	}

	

	canUseSurveyTool() {
		// Check that rally points are set
		if (layers.rallyPointLayer.getSource().getFeatures().length < 2) {
			warning('At least 2 rally points are needed to use the mission survey tool')
			return false
		}
		return true
	}

	/**
	 * Allows SRP state to be set from other componenets by passing it through props.
	 * Uses local storage to carry over constant heading values for less typing.
	 * 
	 * @param {boolean} isSRPEnabled Provides new state of SRP toggle
	 * @returns {void}
	 */
	setIsSRPEnabled(isSRPEnabled: boolean) {
		let bottomDepthSafetyParams: BottomDepthSafetyParams = {
			safety_depth: GlobalSettings.srpParameters.safety_depth.toString(),
			constant_heading: GlobalSettings.constantHeadingParameters.constant_heading.toString(),
			constant_heading_time: GlobalSettings.constantHeadingParameters.constant_heading_time.toString(),
			constant_heading_speed: GlobalSettings.constantHeadingParameters.constant_heading_speed.toString()
		}
		this.setState({ bottomDepthSafetyParams, isSRPEnabled })
	}
	// 
	// Optimize Mission Planning Helper Methods (End)
	// 

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
			this.unselectAllTaskPackets()
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
			goalBeingEdited
		} = this.state;

		// Are we currently in control of the bots?
		const containerClasses = this.weAreInControl() ? 'controlling' : 'noncontrolling'

		const podStatus = this.getPodStatus()
		const bots = podStatus?.bots
		const hubs = podStatus?.hubs
		const metadata = this.getMetadata();

		const self = this

		// Add mission generation form to UI if the survey mission has changed
		let missionSettingsPanel: ReactElement
		if (this.state.mode === Mode.MISSION_PLANNING) {
			missionSettingsPanel = (
				<MissionSettingsPanel
					map={map}
					missionParams={this.state.missionParams}
					setMissionParams={this.setMissionParams.bind(this)}
					missionPlanningGrid={this.state.missionPlanningGrid}
					missionPlanningFeature={this.state.missionPlanningFeature}
					missionBaseGoal={this.state.missionBaseGoal}
					missionStartTask={this.state.missionStartTask}
					missionEndTask={this.state.missionEndTask}
					rallyFeatures={layers.rallyPointLayer.getSource().getFeatures()}
					startRally={this.state.startRally}
					endRally={this.state.endRally}
					centerLineString={this.state.centerLineString}
					runList={this.state.runList}
					bottomDepthSafetyParams={this.state.bottomDepthSafetyParams}
					setBottomDepthSafetyParams={this.setBottomDepthSafetyParams.bind(this)}
					isSRPEnabled={this.state.isSRPEnabled}
					setIsSRPEnabled={this.setIsSRPEnabled.bind(this)}
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
					onMissionApply={(startRally: OlFeature, endRally: OlFeature, startTask: MissionTask, endTask: MissionTask) => {
						this.setState({ startRally, endRally, missionStartTask: startTask, missionEndTask: endTask, })

						if (this.state.missionParams.missionType === 'lines') {
							const { missionPlanningGrid, missionBaseGoal, missionStartTask, missionEndTask } = this.state
							const rallyStartLocation = startRally.get('location')
							const rallyEndLocation = endRally.get('location')

							this.missionPlans = getSurveyMissionPlans(
								rallyStartLocation,
								rallyEndLocation,
								missionPlanningGrid,
								missionBaseGoal,
								missionStartTask,
								missionEndTask
							)

							let runList = this.getRunList()
							this.deleteAllRunsInMission(runList, false).then((confirmed: boolean) => {
								if (!confirmed) return

								for (let id in this.missionPlans) {
									// Mutates runList
									Missions.addRunWithGoals(this.missionPlans[id].bot_id, this.missionPlans[id].plan.goal, runList);
								}

								if (this.state.isSRPEnabled) {
									this.addSRPInputsToRuns()
								} else {
									this.deleteSRPInputsFromRuns()
								}

								// Default to edit mode off for runs created with line tool
								runList.runIdInEditMode = ''
								this.setRunList(runList)
								this.updateMissionHistory(runList)
	
								// Close panel after applying
								this.setVisiblePanel(PanelType.NONE)
							})
						}
					}}
					setSelectedRallyPoint={this.setSelectedRallyPoint.bind(this)}
					areThereRuns={this.areThereRuns.bind(this)}
				/>
			)
		}

		let rcControllerPanel: ReactElement = null
		if (this.isRCModeActive(this.selectedBotId())) {
			rcControllerPanel = (
				<RCControllerPanel 
					api={this.api} 
					bot={bots[this.selectedBotId()]}
					isRCModeActive={this.isRCModeActive(this.selectedBotId())}
					remoteControlValues={this.state.remoteControlValues}
					rcDiveParameters={this.state.rcDives[this.selectedBotId()]}
					createInterval={this.createRemoteControlInterval.bind(this)}
					deleteInterval={this.clearRemoteControlInterval.bind(this)}
					weAreInControl={this.weAreInControl.bind(this)}
					weHaveInterval={this.weHaveRemoteControlInterval.bind(this)}
					setRCDiveParameters={this.setRCDiveParams.bind(this)}
					initRCDivesParams={this.initRCDivesParams.bind(this)}
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
					setRcMode: this.setRcMode.bind(this),
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
				onClick={(evt) => {
					if (!this.canUseSurveyTool()) {
						return
					}

					// Allows seemless switch between Modes, 
					// without it, handleJccContainerClick fires and causes bugs
					evt.stopPropagation()
					this.setVisiblePanel(PanelType.MISSION_SETTINGS)
					this.setState({ mode: Mode.MISSION_PLANNING })

					if (this.state.missionParams.missionType === 'editing')
						this.changeInteraction(this.interactions.selectInteraction, 'grab');
					if (this.state.missionParams.missionType === 'lines')
						this.changeInteraction(this.surveyLines.drawInteraction, 'crosshair');
					if (this.state.missionParams.missionType === 'exclusions')
						this.changeInteraction(this.surveyExclusions.interaction, 'crosshair');

					this.setState({centerLineString: null})

					info('Touch map to set first survey point');
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
				<FontAwesomeIcon icon={faWrench} title="Engineering Panel" />
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

		let visiblePanelElement: ReactElement

		switch (visiblePanel) {
			case PanelType.NONE:
				visiblePanelElement = null
				break

			case PanelType.MISSION:
				visiblePanelElement = (
					<MissionControllerPanel 
					api={this.api} 
					botIds={this.getBotIdList()} 
					mission={this.getRunList()} 
					loadMissionClick={this.loadMissionButtonClicked.bind(this)}
					saveMissionClick={this.saveMissionButtonClicked.bind(this)}
					deleteAllRunsInMission={this.deleteAllRunsInMission.bind(this)}
					deleteSingleRun={this.deleteSingleRun.bind(this)}
					autoAssignBotsToRuns={this.autoAssignBotsToRuns.bind(this)}
					toggleEditMode={this.toggleEditMode.bind(this)}
					unSelectHubOrBot={this.unselectHubOrBot.bind(this)}
					setRunList={this.setRunList.bind(this)}
					updateMissionHistory={this.updateMissionHistory.bind(this)}
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
					<MapLayersPanel />
				)
				break

			case PanelType.RUN_INFO:
				visiblePanelElement = (
					<RunInfoPanel
						setVisiblePanel={this.setVisiblePanel.bind(this)}
						runNum={this.state.flagClickedInfo.runNum}
						botId={this.state.flagClickedInfo.botId}
						deleteRun={this.deleteSingleRun.bind(this)}
					/>
				)
				break
			case PanelType.GOAL_SETTINGS:
				visiblePanelElement = (
					<GoalSettingsPanel
						map={map}
						botId={goalBeingEdited?.botId}
						goalIndex={goalBeingEdited?.goalIndex}
						goal={goalBeingEdited?.goal}
						originalGoal={goalBeingEdited.originalGoal}
						runList={this.getRunList()}
						runNumber={goalBeingEdited?.runNumber}
						onChange={() => this.setRunList(this.getRunList())} 
						setVisiblePanel={this.setVisiblePanel.bind(this)}
						setMoveWptMode={this.setMoveWptMode.bind(this)}
						setRunList={this.setRunList.bind(this)}
						updateMissionHistory={this.updateMissionHistory.bind(this)}
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
			case PanelType.SETTINGS:
				visiblePanelElement = (
					<SettingsPanel
						taskPacketsTimeline={this.state.taskPacketsTimeline}
						isClusterModeOn={this.state.isClusterModeOn}
						handleTaskPacketEditDatesToggle={this.handleTaskPacketEditDatesToggle.bind(this)}
						handleTaskPacketsTimelineChange={this.handleTaskPacketsTimelineChange.bind(this)}
						handleSubmitTaskPacketsTimeline={this.handleSubmitTaskPacketsTimeline.bind(this)}
						handleKeepEndDateCurrentToggle={this.handleKeepEndDateCurrentToggle.bind(this)}
						isTaskPacketsSendBtnDisabled={this.isTaskPacketsSendBtnDisabled.bind(this)}
						setClusterModeStatus={this.setClusterModeStatus.bind(this)}
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

				{this.state.isHelpWindowDisplayed ? <HelpWindow onClose={() => {this.setState({isHelpWindowDisplayed: false})}}></HelpWindow> : null}
				
				{this.state.customAlert}
				
			</div>
		)
	}
}

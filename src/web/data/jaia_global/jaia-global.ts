import cloneDeep from "lodash/cloneDeep";
import {
    NodeTypes,
    SelectedNode,
    SelectedTaskPacket,
    SelectedWaypoint,
    TaskParameters,
} from "../../types/jaia-system-types";
import { MapFeatureTypes, MapModes } from "../../types/openlayers-types";
import {
    DeviceMetadata,
    DeviceMetadata_Version,
} from "../../shared/proto/jaiabot/messages/metadata";
import { UNASSIGNED_ID } from "../../utils/constants";

export interface SelectedZoneVertex {
    zoneID: number;
    vertexIndex: number;
    isMoveable: boolean;
}

export interface JaiaGlobalSnapshot {
    selectedNode: SelectedNode;
    selectedWaypoint: SelectedWaypoint;
    selectedTaskPacket: SelectedTaskPacket;
    mapMode: MapModes;
    defaultTaskParameters: TaskParameters;
    selectedZoneVertex: SelectedZoneVertex;
    zoneInEditMode: number;
}

const defaultTaskParameters: TaskParameters = {
    dive: {
        max_depth: 10,
        depth_interval: 10,
        hold_time: 0,
    },
    drift: {
        drift_time: 0,
    },
    constantHeading: {
        constant_heading: 180,
        constant_heading_time: 30,
        constant_heading_speed: 2,
    },
    stationKeep: {
        station_keep_time: 0,
    },
};

const defaultGitHubVersion = {
    major: "",
    minor: "",
    patch: "",
};

export class JaiaGlobal {
    private selectedNode: SelectedNode;
    private selectedWaypoint: SelectedWaypoint;
    private selectedTaskPacket: SelectedTaskPacket;
    private selectedZoneVertex: SelectedZoneVertex;
    private zoneInEditMode: number;
    private mapMode: MapModes;
    private defaultTaskParameters: TaskParameters;
    private controllingClientID: string;
    private metadata: DeviceMetadata;
    private gitHubVersion: DeviceMetadata_Version;
    private isUpgradeAvailable: boolean;
    private isConnectedToInternet: boolean;

    constructor() {
        this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        this.selectedWaypoint = {
            waypointNum: UNASSIGNED_ID,
            missionID: UNASSIGNED_ID,
            isMoveable: false,
        };
        this.selectedTaskPacket = {
            botID: UNASSIGNED_ID,
            startTime: 0,
            type: MapFeatureTypes.NONE,
        };
        this.selectedZoneVertex = {
            zoneID: UNASSIGNED_ID,
            vertexIndex: UNASSIGNED_ID,
            isMoveable: false,
        };
        this.zoneInEditMode = UNASSIGNED_ID;
        this.mapMode = MapModes.DEFAULT;
        this.defaultTaskParameters = defaultTaskParameters;
        this.metadata = {};
        this.gitHubVersion = defaultGitHubVersion;
        this.isUpgradeAvailable = false;
        this.isConnectedToInternet = false;
    }

    getSelectedNode() {
        return this.selectedNode;
    }

    setSelectedNode(clickedNode: SelectedNode) {
        if (
            clickedNode.type === this.getSelectedNode().type &&
            clickedNode.id === this.getSelectedNode().id
        ) {
            this.selectedNode = { type: NodeTypes.NONE, id: UNASSIGNED_ID };
        } else {
            this.selectedNode = clickedNode;
        }
    }

    getSelectedWaypoint() {
        return this.selectedWaypoint;
    }

    setSelectedWaypoint(clickedWaypoint: SelectedWaypoint) {
        this.selectedWaypoint = clickedWaypoint;
    }

    getSelectedTaskPacket() {
        return this.selectedTaskPacket;
    }

    setSelectedTaskPacket(clickedTaskPacket: SelectedTaskPacket) {
        this.selectedTaskPacket = clickedTaskPacket;
    }

    getMapMode() {
        return this.mapMode;
    }

    setMapMode(mapMode: MapModes) {
        this.mapMode = mapMode;
    }

    getDefaultTaskParameters() {
        return this.defaultTaskParameters;
    }

    setDefaultTaskParameters(defaultTaskParameters: TaskParameters) {
        this.defaultTaskParameters = defaultTaskParameters;
    }

    getControllingClientID() {
        return this.controllingClientID;
    }

    setControllingClientID(controllingClientID: string) {
        this.controllingClientID = controllingClientID;
    }

    getMetadata() {
        return this.metadata;
    }

    setMetadata(metadata: DeviceMetadata) {
        this.metadata = metadata;
    }

    getGitHubVersion() {
        return this.gitHubVersion;
    }

    setGitHubVersion(version: DeviceMetadata_Version) {
        this.gitHubVersion = version;
    }

    getIsUpgradeAvailable() {
        return this.isUpgradeAvailable;
    }

    setIsUpgradeAvailable(isUpgradeAvailable: boolean) {
        this.isUpgradeAvailable = isUpgradeAvailable;
    }

    getIsConnectedToInternet() {
        return this.isConnectedToInternet;
    }

    setIsConnectedToInternet(isConnectedToInternet: boolean) {
        this.isConnectedToInternet = isConnectedToInternet;
    }

    resetSelectedWaypoint() {
        this.selectedWaypoint = {
            waypointNum: UNASSIGNED_ID,
            missionID: UNASSIGNED_ID,
            isMoveable: false,
        };
    }

    getSelectedZoneVertex() {
        return this.selectedZoneVertex;
    }

    setSelectedZoneVertex(vertex: SelectedZoneVertex) {
        this.selectedZoneVertex = vertex;
    }

    resetSelectedZoneVertex() {
        this.selectedZoneVertex = {
            zoneID: UNASSIGNED_ID,
            vertexIndex: UNASSIGNED_ID,
            isMoveable: false,
        };
    }

    getZoneInEditMode() {
        return this.zoneInEditMode;
    }

    setZoneInEditMode(zoneID: number) {
        this.zoneInEditMode = zoneID;
    }

    resetSelectedTaskPacket() {
        this.selectedTaskPacket = {
            botID: UNASSIGNED_ID,
            startTime: 0,
            type: MapFeatureTypes.NONE,
        };
    }

    /**
     * Captures snapshot of JaiaGlobal
     *
     * @returns {JaiaGlobalSnapshot} Snapshot of JaiaGlobal
     */
    captureSnapshot() {
        const snapshot: JaiaGlobalSnapshot = {
            selectedNode: this.selectedNode,
            selectedWaypoint: this.selectedWaypoint,
            selectedTaskPacket: this.selectedTaskPacket,
            mapMode: this.mapMode,
            defaultTaskParameters: this.defaultTaskParameters,
            selectedZoneVertex: this.selectedZoneVertex,
            zoneInEditMode: this.zoneInEditMode,
        };
        return cloneDeep(snapshot);
    }

    /**
     * Replaces the current properties with those from the saved snapshot
     *
     * @param {JaiaGlobalSnapshot} snapshot Snapshot of JaiaGlobal
     * @returns {void}
     */

    restoreFromSnapshot(snapshot: JaiaGlobalSnapshot) {
        const restored = cloneDeep(snapshot);
        this.selectedNode = restored.selectedNode;
        this.selectedWaypoint = restored.selectedWaypoint;
        this.selectedTaskPacket = restored.selectedTaskPacket;
        this.mapMode = restored.mapMode;
        this.defaultTaskParameters = restored.defaultTaskParameters;
        this.selectedZoneVertex = restored.selectedZoneVertex ?? {
            zoneID: UNASSIGNED_ID,
            vertexIndex: UNASSIGNED_ID,
            isMoveable: false,
        };
        this.zoneInEditMode = restored.zoneInEditMode ?? UNASSIGNED_ID;
    }
}

export const jaiaGlobal = new JaiaGlobal();

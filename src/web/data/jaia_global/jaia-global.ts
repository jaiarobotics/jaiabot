import cloneDeep from "lodash/cloneDeep";
import {
    NodeTypes,
    SelectedNode,
    SelectedTaskPacket,
    SelectedWaypoint,
    TaskParameters,
} from "../../types/jaia-system-types";
import { MapFeatureTypes, MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Metadata } from "../../types/protobuf-types";

export interface JaiaGlobalSnapshot {
    selectedNode: SelectedNode;
    selectedWaypoint: SelectedWaypoint;
    selectedTaskPacket: SelectedTaskPacket;
    defaultTaskParameters: TaskParameters;
    mapMode: MapModes;
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

export class JaiaGlobal {
    private selectedNode: SelectedNode;
    private selectedWaypoint: SelectedWaypoint;
    private selectedTaskPacket: SelectedTaskPacket;
    private mapMode: MapModes;
    private defaultTaskParameters: TaskParameters;
    private controllingClientID: string;
    private metadata: Metadata;

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
        this.mapMode = MapModes.DEFAULT;
        this.defaultTaskParameters = defaultTaskParameters;
        this.metadata = {};
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

    setMetadata(metadata: Metadata) {
        this.metadata = metadata;
    }

    resetSelectedWaypoint() {
        this.selectedWaypoint = {
            waypointNum: UNASSIGNED_ID,
            missionID: UNASSIGNED_ID,
            isMoveable: false,
        };
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
    }
}

export const jaiaGlobal = new JaiaGlobal();

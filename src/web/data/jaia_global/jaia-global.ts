import {
    NodeTypes,
    SelectedNode,
    SelectedTaskPacket,
    SelectedWaypoint,
    TaskParameters,
} from "../../types/jaia-system-types";
import { MapFeatureTypes, MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import cloneDeep from "lodash/cloneDeep";

export interface JaigGlobalSnapshot {
    selectedNode: SelectedNode;
    selectedWaypoint: SelectedWaypoint;
    selectedTaskPacket: SelectedTaskPacket;
    mapMode: MapModes;
    defaultTaskParameters: TaskParameters;
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
};

export class JaiaGlobal {
    private selectedNode: SelectedNode;
    private selectedWaypoint: SelectedWaypoint;
    private selectedTaskPacket: SelectedTaskPacket;
    private mapMode: MapModes;
    private defaultTaskParameters: TaskParameters;

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

    /**
     * Captures a snapshot of JaiaGlobal
     *
     * @returns {JaigGlobalSnapshot} snapshot of current Grid Plan
     */
    captureSnapshot() {
        const currentGlobals = {
            selectedNode: this.selectedNode,
            selectedWaypoint: this.selectedWaypoint,
            selectedTaskPacket: this.selectedTaskPacket,
            mapMode: this.mapMode,
            defaultTaskParameters: this.defaultTaskParameters,
        } as JaigGlobalSnapshot;
        return cloneDeep(currentGlobals);
    }

    /**
     * Replaces the current globals with those from a saved snapshot
     *
     * @param {JaigGlobalSnapshot} snapshot Snapshot of JaiaGlobal
     * @returns {void}
     *
     */

    restoreFromSnapshot(snapshot: JaigGlobalSnapshot) {
        this.selectedNode = snapshot.selectedNode;
        this.selectedWaypoint = snapshot.selectedWaypoint;
        this.selectedTaskPacket = snapshot.selectedTaskPacket;
        this.mapMode = snapshot.mapMode;
        this.defaultTaskParameters = snapshot.defaultTaskParameters;
    }
}

export const jaiaGlobal = new JaiaGlobal();

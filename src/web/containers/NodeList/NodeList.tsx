import React, { useContext } from "react";
import {
    GlobalContext,
    GlobalDispatchContext,
    GlobalAction,
    GlobalContextType,
} from "../../context/Global/GlobalContext";
import {
    JaiaSystemContext,
    JaiaSystemContextType,
} from "../../context/JaiaSystem/JaiaSystemContext";
import { GlobalActions } from "../../context/Global/GlobalActions";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

import { NodeTypes } from "../../types/jaia-system-types";
import { HealthState } from "../../shared/JAIAProtobuf";

import sortBy from "lodash/sortBy";

import "./NodeList.less";

export function NodeList() {
    const jaiaSystemContext: JaiaSystemContextType = useContext(JaiaSystemContext);
    const globalContext: GlobalContextType = useContext(GlobalContext);
    const globalDispatch: React.Dispatch<GlobalAction> = useContext(GlobalDispatchContext);

    if (jaiaSystemContext === null || globalContext === null) {
        return <div></div>;
    }

    const hubs = sortBy(Array.from(jaiaSystemContext.hubs.values()), ["hubID"]);
    const bots = sortBy(Array.from(jaiaSystemContext.bots.values()), ["botID"]);

    /**
     * Triggered when a node item is clicked. Sets the selected node in the data model,
     * then dispatches an action to GlobalContext to handle the node click
     *
     * @param {NodeTypes} nodeType Indicates Bot or Hub
     * @param {number} nodeID Provides Bot or Hub ID
     * @returns {void}
     */
    const handleClick = (nodeType: NodeTypes, nodeID: number) => {
        // Update data model
        jaiaGlobal.setSelectedNode({ type: nodeType, id: nodeID });

        // Update GlobalContext
        globalDispatch({
            type: GlobalActions.CLICKED_NODE,
        });
    };

    /**
     * Creates the class name that applies the correct style to a node item
     * based on type, selection, and health
     *
     * @param {NodeTypes} nodeType Indicates Bot or Hub
     * @param {number} nodeID Provides ID of Bot or Hub
     * @param {HealthState} healthState Determines color of node item
     * @returns {string} Class name that sets correct style
     */
    function getClassName(nodeType: NodeTypes, nodeID: number, healthState: HealthState) {
        const faultLevel: Map<HealthState, number> = new Map([
            [HealthState.HEALTH__OK, 0],
            [HealthState.HEALTH__DEGRADED, 1],
            [HealthState.HEALTH__FAILED, 2],
        ]);

        const nodeTypeClass = nodeType === NodeTypes.BOT ? "bot-item" : "hub-item";
        const faultLevelClass = "faultLevel" + faultLevel.get(healthState);
        const selectedNode = globalContext.selectedNode;
        const selectedClass =
            selectedNode.type === nodeType && selectedNode.id === nodeID ? "selected" : "";

        return `node-item ${nodeTypeClass} ${faultLevelClass} ${selectedClass}`;
    }

    return (
        <div id="nodeList" data-testid="nodeList">
            {hubs.map((hub) => (
                <div
                    key={`hub-${hub.getHubID()}`}
                    onClick={() => handleClick(NodeTypes.HUB, hub.getHubID())}
                    className={getClassName(NodeTypes.HUB, hub.getHubID(), hub.getHealthState())}
                >
                    {"HUB"}
                </div>
            ))}
            {bots.map((bot) => (
                <div
                    key={`bot-${bot.getBotID()}`}
                    onClick={() => handleClick(NodeTypes.BOT, bot.getBotID())}
                    className={getClassName(NodeTypes.BOT, bot.getBotID(), bot.getHealthState())}
                >
                    {bot.getBotID()}
                </div>
            ))}
        </div>
    );
}

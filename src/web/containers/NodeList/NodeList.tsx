import React, { useContext } from "react";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import {
    JaiaContext,
    JaiaContextType,
    JaiaDispatchContext,
    JaiaAction,
} from "../../context/Jaia/JaiaContext";

import { NodeTypes } from "../../types/jaia-system-types";
import { HealthState } from "../../types/protobuf-types";

import "./NodeList.less";

export function NodeList() {
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const JaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    const hubs = Array.from(jaiaContext.hubs.values());
    const bots = Array.from(jaiaContext.bots.values());

    /**
     * Dispatches the CLICKED_NODE action to JaiaContext for further handling
     *
     * @param {NodeTypes} nodeType Indicates Bot or Hub
     * @param {number} nodeID Provides Bot or Hub ID
     * @returns {void}
     */
    const handleClick = (nodeType: NodeTypes, nodeID: number) => {
        JaiaDispatch({
            type: JaiaActions.CLICKED_NODE,
            selectedNode: { type: nodeType, id: nodeID },
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
        const selectedNode = jaiaContext.selectedNode;
        const selectedClass =
            selectedNode.type === nodeType && selectedNode.id === nodeID ? "selected" : "";

        return `node-item ${nodeTypeClass} ${faultLevelClass} ${selectedClass}`;
    }

    console.log(bots);

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

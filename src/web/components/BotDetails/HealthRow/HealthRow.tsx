import { useContext } from "react";
import { JaiaContext } from "../../../context/JaiaContext";

import { NodeTypes } from "../../../types/jaia-system-types";
import { HealthState } from "../../../shared/proto/goby/middleware/protobuf/coroner";
import { Error, Warning } from "../../../shared/proto/jaiabot/messages/health";

import "./HealthRow.less";

/**
 * Creates the contents of the health accordion in the details panels
 */
export default function HealthRow() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    const selectedNode = jaiaContext.jaiaGlobal.getSelectedNode();

    let healthState = HealthState.HEALTH__DEGRADED;
    let errors: Error[] = [];
    let warnings: Warning[] = [];

    switch (selectedNode.type) {
        case NodeTypes.BOT:
            const bot = jaiaContext.bots.getBot(selectedNode.id);
            healthState = bot.getHealthState();
            errors = bot.getErrors();
            warnings = bot.getWarnings();
            break;
        case NodeTypes.HUB:
            const hub = jaiaContext.hubs.getHub(selectedNode.id);
            healthState = hub.getHealthState();
            errors = hub.getErrors();
            warnings = hub.getWarnings();
            break;
    }

    /**
     * Provides the CSS class name mapping health state to color
     *
     * @returns {string} CSS class name corresponding to health state
     */
    const getHealthStateClassName = () => {
        switch (healthState) {
            case HealthState.HEALTH__OK:
                return "health-state-ok";
            case HealthState.HEALTH__DEGRADED:
                return "health-state-degraded";
            case HealthState.HEALTH__FAILED:
                return "health-state-failed";
        }
    };

    return (
        <div className="health-row">
            <p className={getHealthStateClassName()}>{healthState}</p>
            {errors.map((error, index) => (
                <p className="error" key={index}>
                    {error}
                </p>
            ))}
            {warnings.map((warning, index) => (
                <p className="warning" key={index}>
                    {warning}
                </p>
            ))}
        </div>
    );
}

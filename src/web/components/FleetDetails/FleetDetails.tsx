import React, { useContext, useEffect } from "react";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaAction, FleetAccordionNames } from "../../types/context-types";
import { HealthState } from "../../types/protobuf-types";
import { fleet, CommandResultGroup } from "../../data/fleet/fleet";
import { accordionTheme, addDropdownListener } from "../../utils/style";
import { NodeTypes } from "../../types/jaia-system-types";

import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { ThemeProvider } from "@mui/material";

import "./FleetDetails.less";

export default function FleetDetails() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    useEffect(() => {
        addDropdownListener("accordion-container", "fleet-details-accordions-container");
    }, []);

    if (!jaiaContext) {
        return;
    }

    const selectedNode = jaiaContext.jaiaGlobal.getSelectedNode();
    if (selectedNode.type !== NodeTypes.FLEET) {
        return;
    }

    const hubs = Array.from(jaiaContext.hubs.getHubs().values());
    const bots = Array.from(jaiaContext.bots.getBots().values());
    const fleetID = selectedNode.id || hubs[0]?.getFleetID() || 1;

    function handleClosePanel() {
        jaiaDispatch({ type: JaiaActions.CLOSED_DETAILS });
    }

    function handleAccordionClick(accordionName: FleetAccordionNames) {
        jaiaDispatch({
            type: JaiaActions.CLICKED_FLEET_ACCORDION,
            fleetAccordionName: accordionName,
        });
    }

    function healthStateLabel(state: HealthState): string {
        switch (state) {
            case HealthState.HEALTH__OK:
                return "OK";
            case HealthState.HEALTH__DEGRADED:
                return "Degraded";
            case HealthState.HEALTH__FAILED:
                return "Failed";
            default:
                return "Unknown";
        }
    }

    function healthStateClass(state: HealthState): string {
        switch (state) {
            case HealthState.HEALTH__OK:
                return "health-ok";
            case HealthState.HEALTH__DEGRADED:
                return "health-degraded";
            case HealthState.HEALTH__FAILED:
                return "health-failed";
            default:
                return "";
        }
    }


    const botHealthState = fleet.computeWorstHealthState(
        bots.map((b) => b.getHealthState()).filter(Boolean) as HealthState[],
    );
    const hubHealthState = fleet.computeWorstHealthState(
        hubs.map((h) => h.getHealthState()).filter(Boolean) as HealthState[],
    );
    const commandGroups = fleet.getCommandResultGroups();

    function groupSummary(group: CommandResultGroup): string {
        const total = group.totalBots;
        const acked = group.successCount;
        const failed = group.failureCount;

        if (failed === 0) {
            return `${acked}/${total} bot${total !== 1 ? "s" : ""} ACKed`;
        }

        return `${acked}/${total} bot${total !== 1 ? "s" : ""} ACKed, ${failed} failed`;
    }


    return (
        <div className="node-details">
            <div className="details-heading">
                <div className="title-bar">
                    <h2>{`Fleet ${fleetID}`}</h2>
                    <div className="close-button" onClick={handleClosePanel}>
                        ⨯
                    </div>
                </div>
            </div>

            <div className="accordions-container" id="fleet-details-accordions-container">
                <ThemeProvider theme={accordionTheme}>
                    <Accordion
                        expanded={jaiaContext.fleetAccordionStates.quickLook}
                        onChange={() => handleAccordionClick(FleetAccordionNames.QUICKLOOK)}
                        className="accordion-container"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Quick Look</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <table className="quick-look-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Total</th>
                                        <th>Health</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Bots</td>
                                        <td>{bots.length}</td>
                                        <td>
                                            <span
                                                className={`health-badge ${healthStateClass(botHealthState)}`}
                                            >
                                                {healthStateLabel(botHealthState)}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Hubs</td>
                                        <td>{hubs.length}</td>
                                        <td>
                                            <span
                                                className={`health-badge ${healthStateClass(hubHealthState)}`}
                                            >
                                                {healthStateLabel(hubHealthState)}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion
                        expanded={jaiaContext.fleetAccordionStates.commands}
                        onChange={() => handleAccordionClick(FleetAccordionNames.COMMANDS)}
                        className="accordion-container"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Command ACKs</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {commandGroups.length === 0 ? (
                                <p className="fleet-no-commands">No command results yet.</p>
                            ) : (
                                <table className="command-ack-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Command</th>
                                            <th>Acks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {commandGroups.map((group, idx) => (
                                            <tr
                                                key={`${group.commandType}-${group.timestamp}-${idx}`}
                                                className={
                                                    group.failureCount > 0
                                                        ? "row-has-failure"
                                                        : "row-all-success"
                                                }
                                            >
                                                <td className="cmd-counter">{idx + 1}</td>
                                                <td className="cmd-type">
                                                    {group.commandType.replace(/_/g, " ")}
                                                </td>
                                                <td className="cmd-result">
                                                    <div>{groupSummary(group)}</div>
                                                    {group.failedBotIDs.length > 0 && (
                                                        <div className="failed-bots">
                                                            Failed: Bot {group.failedBotIDs.join(", Bot ")}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    );
}

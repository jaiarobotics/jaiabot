import { useContext, useEffect } from "react";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaAction, FleetAccordionNames } from "../../types/context-types";
import { HealthState } from "../../types/protobuf-types";
import { CommsResult } from "../../shared/JAIAProtobuf";
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

    const hubs = Array.from(jaiaContext.hubs.getHubs().values());
    const bots = Array.from(jaiaContext.bots.getBots().values());

    /**
     * Dispatches an action to close the Fleet details panel
     */
    function handleClosePanel() {
        jaiaDispatch({ type: JaiaActions.CLOSED_DETAILS });
    }

    /**
     * Dispatches an action to toggle accordion states
     */
    function handleAccordionClick(accordionName: FleetAccordionNames) {
        jaiaDispatch({
            type: JaiaActions.CLICKED_FLEET_ACCORDION,
            fleetAccordionName: accordionName,
        });
    }

    /**
     * Returns a human-readable label for a HealthState
     */
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

    /**
     * Returns the CSS class that corresponds to the health state
     */
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

    /**
     * Computes the worst health state from an array of states
     */
    function worstHealthState(states: HealthState[]): HealthState {
        const filtered = states.filter(Boolean);
        if (filtered.includes(HealthState.HEALTH__FAILED)) return HealthState.HEALTH__FAILED;
        if (filtered.includes(HealthState.HEALTH__DEGRADED)) return HealthState.HEALTH__DEGRADED;
        return HealthState.HEALTH__OK;
    }

    const botHealthState = worstHealthState(bots.map((b) => b.getHealthState()));
    const hubHealthState = worstHealthState(hubs.map((h) => h.getHealthState()));
    const commandGroups = fleet.getCommandResultGroups();

    /**
     * Returns a summary string for a command result group
     */
    function groupSummary(group: CommandResultGroup): string {
        const total = group.totalBots;
        const acked = group.successCount;
        const failed = group.failureCount;

        if (failed === 0) {
            return `${acked}/${total} bot${total !== 1 ? "s" : ""} ACKed`;
        }
        return `${acked}/${total} bot${total !== 1 ? "s" : ""} ACKed, ${failed} failed`;
    }

    /**
     * Returns the bot IDs that failed in a command result group
     */
    function failedBotIds(group: CommandResultGroup): number[] {
        return group.results
            .filter((r) => r.result !== CommsResult.SUCCESS)
            .map((r) => r.orig_command?.bot_id)
            .filter((id): id is number => id != null);
    }

    return (
        <div className="node-details">
            <div className="details-heading">
                <div className="title-bar">
                    <h2>Fleet 1</h2>
                    <div className="close-button" onClick={handleClosePanel}>
                        ⨯
                    </div>
                </div>
            </div>

            <div className="accordions-container" id="fleet-details-accordions-container">
                <ThemeProvider theme={accordionTheme}>
                    {/* Quick Look accordion */}
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
                                            <span className={`health-badge ${healthStateClass(botHealthState)}`}>
                                                {healthStateLabel(botHealthState)}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Hubs</td>
                                        <td>{hubs.length}</td>
                                        <td>
                                            <span className={`health-badge ${healthStateClass(hubHealthState)}`}>
                                                {healthStateLabel(hubHealthState)}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>

                    {/* Command ACK accordion */}
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
                                                key={idx}
                                                className={group.failureCount > 0 ? "row-has-failure" : "row-all-success"}
                                            >
                                                <td className="cmd-counter">
                                                    {idx + 1}
                                                </td>
                                                <td className="cmd-type">
                                                    {group.commandType}
                                                </td>
                                                <td className="cmd-result">
                                                    <div>{groupSummary(group)}</div>
                                                    {failedBotIds(group).length > 0 && (
                                                        <div className="failed-bots">
                                                            Failed: Bot{" "}
                                                            {failedBotIds(group).join(", Bot ")}
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

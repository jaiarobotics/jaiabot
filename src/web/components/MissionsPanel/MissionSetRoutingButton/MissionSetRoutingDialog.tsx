import { useContext } from "react";
import { createPortal } from "react-dom";

import RoutingActionButton from "../RoutingDialog/RoutingActionButton";
import { describeMissionSetReport, describeMissionSetStatus } from "../RoutingDialog/routing-text";
import { useRoutingAction } from "../RoutingDialog/use-routing-action";

import { JaiaContext } from "../../../context/JaiaContext";
import { buildZoneGeometry } from "../../../utils/routing/router";
import { getRoutingStatus } from "../../../utils/routing/routing-status";

import "../RoutingDialog/RoutingDialog.less";

interface Props {
    onClose: () => void;
}

/**
 * Shows how many missions in the set cross a zone, with Reroute all and Restore all, and
 * reports what this dialog's last action did.
 */
export default function MissionSetRoutingDialog({ onClose }: Props) {
    const jaiaContext = useContext(JaiaContext);
    const { running, lastRun, run } = useRoutingAction();

    const missions = Array.from(jaiaContext.missionSet.getMissions().values());
    const routable = missions.filter((mission) => mission.getOriginalWaypoints().length > 0);
    const rerouted = missions.filter((mission) => mission.isRerouted());
    const geometry = buildZoneGeometry(jaiaContext.exclusionZoneSet.getZones());
    const statusLines = describeMissionSetStatus(
        routable.map((mission) => getRoutingStatus(mission, geometry)),
        missions.length,
    );
    const outcomes = lastRun ? jaiaContext.rerouteReport : null;
    const report = lastRun && outcomes ? describeMissionSetReport(lastRun, outcomes) : undefined;

    // Rendered on the body so a positioned panel cannot stack above it
    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog routing-dialog">
                <h1>Mission Set</h1>
                {statusLines.map((line) => (
                    <p key={line}>{line}</p>
                ))}
                {report && (
                    <div className="routing-report">
                        <p>{report.summary}</p>
                        {report.unchanged.length > 0 && (
                            <ul className="routing-report-unchanged">
                                {report.unchanged.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                <div className="dialog-button-row">
                    <RoutingActionButton
                        label="Reroute all"
                        isRunning={running === "reroute"}
                        disabled={running !== null || routable.length === 0}
                        onClick={() =>
                            run(
                                "reroute",
                                routable.map((mission) => mission.getMissionID()),
                            )
                        }
                    />
                    <RoutingActionButton
                        label="Restore all"
                        isRunning={running === "restore"}
                        disabled={running !== null || rerouted.length === 0}
                        onClick={() =>
                            run(
                                "restore",
                                rerouted.map((mission) => mission.getMissionID()),
                            )
                        }
                    />
                </div>
                <button className="dialog-button" onClick={onClose} disabled={running !== null}>
                    Close
                </button>
            </div>
        </div>,
        document.body,
    );
}

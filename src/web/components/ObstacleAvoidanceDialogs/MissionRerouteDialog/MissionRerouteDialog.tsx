import { useContext } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { MAX_WAYPOINTS } from "../../../utils/constants";
import {
    PendingReroute,
    ProposalStatus,
} from "../../../data/obstacle_avoidance_data/pending-route-data";
import ObstacleAvoidanceBaseDialog from "../ObstacleAvoidanceBaseDialog";
import RerouteSummary from "../RerouteSummary";

export default function MissionRerouteDialog({ pending }: { pending: PendingReroute }) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const isZoneLoad = pending.loadedZoneIDs !== undefined;
    const isMissionLoad = pending.loadedMissionIDs !== undefined;

    const feasible = pending.proposals.filter((p) => p.status === ProposalStatus.FEASIBLE);
    const overLimit = pending.proposals.filter((p) => p.status === ProposalStatus.OVER_LIMIT);
    const impossible = pending.proposals.filter((p) => p.status === ProposalStatus.IMPOSSIBLE);
    const hasFeasibleReroute = feasible.length > 0;

    const skippedZones = pending.skippedZoneIDs ?? [];
    const loadedZones = pending.loadedZoneIDs ?? [];
    const skippedMissions = pending.skippedMissionIDs ?? [];
    const loadedMissions = pending.loadedMissionIDs ?? [];

    const canProceed = isZoneLoad
        ? loadedZones.length > 0
        : isMissionLoad
          ? loadedMissions.length > 0
          : true;

    const handleCancel = () => jaiaDispatch({ type: JaiaActions.CANCEL_MISSION_REROUTE });
    const handleConfirm = () => jaiaDispatch({ type: JaiaActions.CONFIRM_MISSION_REROUTE });

    const buttons = [
        {
            label: isZoneLoad || isMissionLoad || !hasFeasibleReroute ? "Revert All" : "Revert",
            onClick: handleCancel,
        },
    ];
    if (canProceed && hasFeasibleReroute) {
        buttons.push({ label: "Confirm", onClick: handleConfirm });
    }

    return (
        <ObstacleAvoidanceBaseDialog title="Route Update Required" buttons={buttons}>
            {/* Zone load */}
            {isZoneLoad && loadedZones.length > 0 && (
                <p>
                    <strong>{loadedZones.length}</strong> zone
                    {loadedZones.length !== 1 ? "s" : ""} loaded
                    {pending.totalBypassCount > 0 && (
                        <>
                            {" "}
                            with <strong>{pending.totalBypassCount}</strong> bypass waypoint
                            {pending.totalBypassCount !== 1 ? "s" : ""}
                        </>
                    )}
                    .
                </p>
            )}
            {isZoneLoad && skippedZones.length > 0 && (
                <>
                    <p className="dialog-warn">
                        <strong>{skippedZones.length}</strong> zone
                        {skippedZones.length !== 1 ? "s" : ""} could not be loaded — routing around{" "}
                        {skippedZones.length !== 1 ? "them" : "it"} is impossible or would exceed
                        the {MAX_WAYPOINTS}-waypoint limit:
                    </p>
                    <ul className="dialog-warn-list">
                        {skippedZones.map((id) => (
                            <li key={id}>Zone {id}</li>
                        ))}
                    </ul>
                </>
            )}

            {/* Mission load */}
            {isMissionLoad && loadedMissions.length > 0 && (
                <p>
                    <strong>{loadedMissions.length}</strong> mission
                    {loadedMissions.length !== 1 ? "s" : ""} loaded
                    {pending.totalBypassCount > 0 && (
                        <>
                            {" "}
                            with <strong>{pending.totalBypassCount}</strong> bypass waypoint
                            {pending.totalBypassCount !== 1 ? "s" : ""}
                        </>
                    )}
                    .
                </p>
            )}
            {isMissionLoad && skippedMissions.length > 0 && (
                <>
                    <p className="dialog-warn">
                        <strong>{skippedMissions.length}</strong> mission
                        {skippedMissions.length !== 1 ? "s" : ""} could not be loaded — routing
                        around existing zones is impossible or would exceed the {MAX_WAYPOINTS}
                        -waypoint limit:
                    </p>
                    <ul className="dialog-warn-list">
                        {skippedMissions.map((id) => (
                            <li key={id}>Mission {id}</li>
                        ))}
                    </ul>
                </>
            )}

            {/* Non-load: reroute summary */}
            {!isZoneLoad && !isMissionLoad && feasible.length > 0 && (
                <p>
                    The mission{feasible.length !== 1 ? "s" : ""} ha
                    {feasible.length !== 1 ? "ve" : "s"} been rerouted to include{" "}
                    <strong>{pending.totalBypassCount}</strong> bypass waypoint
                    {pending.totalBypassCount !== 1 ? "s" : ""}.
                </p>
            )}

            {!isZoneLoad && !isMissionLoad && feasible.length === 0 && (
                <p className="dialog-warn">None of the missions can be rerouted.</p>
            )}

            <RerouteSummary
                proposals={pending.proposals}
                overLimitMessage={`The following mission${overLimit.length !== 1 ? "s" : ""} will be removed from the plan — adding bypass waypoints would exceed the ${MAX_WAYPOINTS}-waypoint limit:`}
                impossibleMessage={`The following mission${impossible.length !== 1 ? "s" : ""} have no clear route around the zone — move the conflicting waypoints further away or resize the zone:`}
                showOverLimit={!isMissionLoad}
            />
        </ObstacleAvoidanceBaseDialog>
    );
}

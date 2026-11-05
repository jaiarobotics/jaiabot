import { useContext } from "react";
import { mdiMapMarkerPath } from "@mdi/js";

import MissionStatusIcon, { StatusLevel } from "../MissionStatusIcon/MissionStatusIcon";

import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { ButtonNames, ButtonTypes } from "../../../types/context-types";
import { getWorstRoutingLevel, RoutingLevel } from "../../../utils/routing/routing-status";

const STATUSES: Record<RoutingLevel, { level: StatusLevel; label: string }> = {
    [RoutingLevel.CROSSES_ZONE]: { level: "error", label: "a route crosses an exclusion zone" },
    [RoutingLevel.HAS_CLEAR_SUPPRESSED]: {
        level: "warning",
        label: "some missions have suppressed waypoints that are clear again",
    },
    [RoutingLevel.CLEAR]: { level: "normal", label: "nothing to do" },
};

interface Props {
    /** Each mission's routing level by mission ID, undefined for a mission with no waypoints */
    routingLevels: ReadonlyMap<number, RoutingLevel | undefined>;
}

/**
 * The most urgent routing status across a mission set, which opens the routing panel for the
 * mission set. Disabled while no mission has waypoints.
 */
export default function MissionSetRoutingButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const routingLevel = getWorstRoutingLevel(props.routingLevels.values());
    const { level, label } =
        routingLevel === undefined
            ? { level: "normal" as const, label: "no waypoints" }
            : STATUSES[routingLevel];
    return (
        <MissionStatusIcon
            level={level}
            iconPath={mdiMapMarkerPath}
            label={`Mission set routing status: ${label}`}
            onClick={() =>
                jaiaDispatch({
                    type: JaiaActions.CLICKED_BUTTON,
                    buttonType: ButtonTypes.MAP_MODE,
                    buttonName: ButtonNames.ROUTING_PANEL,
                    routingTarget: { kind: "missionSet" },
                })
            }
            disabled={routingLevel === undefined}
        />
    );
}

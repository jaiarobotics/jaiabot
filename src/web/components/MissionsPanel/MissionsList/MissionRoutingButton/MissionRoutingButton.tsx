import { useContext } from "react";
import { mdiMapMarkerPath } from "@mdi/js";

import MissionStatusIcon, { StatusLevel } from "../../MissionStatusIcon/MissionStatusIcon";

import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import Mission from "../../../../data/mission_set/mission";
import { ButtonNames, ButtonTypes } from "../../../../types/context-types";
import { RoutingLevel } from "../../../../utils/routing/routing-status";

const STATUSES: Record<RoutingLevel, { level: StatusLevel; label: string }> = {
    [RoutingLevel.CROSSES_ZONE]: { level: "error", label: "the route crosses an exclusion zone" },
    [RoutingLevel.HAS_CLEAR_SUPPRESSED]: {
        level: "warning",
        label: "some suppressed waypoints are clear again",
    },
    [RoutingLevel.CLEAR]: { level: "normal", label: "nothing to do" },
};

interface Props {
    mission: Mission;
    /** The mission's routing level, undefined when it has no waypoints */
    routingLevel: RoutingLevel | undefined;
}

/**
 * A mission's routing status, which opens the routing panel for the mission. Disabled while the
 * mission has no waypoints.
 */
export default function MissionRoutingButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const { routingLevel } = props;
    const { level, label } =
        routingLevel === undefined
            ? { level: "normal" as const, label: "no waypoints" }
            : STATUSES[routingLevel];
    return (
        <MissionStatusIcon
            level={level}
            iconPath={mdiMapMarkerPath}
            label={`Routing status: ${label}`}
            onClick={() =>
                jaiaDispatch({
                    type: JaiaActions.CLICKED_BUTTON,
                    buttonType: ButtonTypes.MAP_MODE,
                    buttonName: ButtonNames.ROUTING_PANEL,
                    routingTarget: { kind: "mission", missionID: props.mission.getMissionID() },
                })
            }
            disabled={routingLevel === undefined}
        />
    );
}

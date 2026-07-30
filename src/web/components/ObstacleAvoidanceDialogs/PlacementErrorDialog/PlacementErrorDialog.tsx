import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import ObstacleAvoidanceBaseDialog from "../ObstacleAvoidanceBaseDialog";

/**
 * Modal shown when a waypoint placement is blocked because the location falls
 * inside an exclusion zone or its safety buffer.
 */
export default function PlacementErrorDialog() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    if (!jaiaContext?.obstacleAvoidanceData.getPlacementError()) return null;

    const handleOkClick = () => jaiaDispatch({ type: JaiaActions.CLEAR_PLACEMENT_ERROR });

    return (
        <ObstacleAvoidanceBaseDialog
            title="Placement Not Allowed"
            buttons={[{ label: "OK", onClick: handleOkClick }]}
        >
            <p>{jaiaContext.obstacleAvoidanceData.getPlacementError()}</p>
        </ObstacleAvoidanceBaseDialog>
    );
}

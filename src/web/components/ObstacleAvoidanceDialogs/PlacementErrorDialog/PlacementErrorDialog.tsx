import { useContext } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import ObstacleAvoidanceBaseDialog from "../Common/ObstacleAvoidanceBaseDialog";

/**
 * Modal shown when a waypoint placement is blocked because the location falls
 * inside an exclusion zone or its safety buffer.
 */
export default function PlacementErrorDialog({
    message,
    onDismiss,
}: {
    message: string;
    onDismiss?: () => void;
}) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const handleOkClick =
        onDismiss ?? (() => jaiaDispatch({ type: JaiaActions.CLEAR_PLACEMENT_ERROR }));

    return (
        <ObstacleAvoidanceBaseDialog
            title="Placement Not Allowed"
            buttons={[{ label: "OK", onClick: handleOkClick }]}
        >
            <p>{message}</p>
        </ObstacleAvoidanceBaseDialog>
    );
}

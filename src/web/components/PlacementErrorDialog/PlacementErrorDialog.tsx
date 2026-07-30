import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

/**
 * Modal shown when a waypoint placement is blocked because the location falls
 * inside an exclusion zone or its safety buffer.
 */
export default function PlacementErrorDialog() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    if (!jaiaContext?.placementError) return null;

    const handleOkClick = () => jaiaDispatch({ type: JaiaActions.CLEAR_PLACEMENT_ERROR });

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Placement Not Allowed</h1>
                <p>{jaiaContext.placementError}</p>
                <div className="dialog-button-row">
                    <button className="dialog-button" onClick={handleOkClick}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}

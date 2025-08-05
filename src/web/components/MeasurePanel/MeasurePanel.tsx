import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import { KILOMETER_FACTOR } from "../../utils/constants";
import "./MeasurePanel.less";

/**
 * Displays the distance measured from the measure tool
 */
export default function MeasurePanel() {
    const jaiaContext = useContext(JaiaContext);

    const formatDistance = () => {
        const distance = jaiaContext.measureDistance;
        if (distance > KILOMETER_FACTOR) {
            return (distance / KILOMETER_FACTOR).toFixed(1) + " km";
        }
        return distance.toFixed(0) + " m";
    };

    return (
        <div className="jaia-panel measure-panel">
            <div className="jaia-panel-title">Measure</div>
            <div className="distance-container">
                <div>Distance:</div>
                <div>{formatDistance()}</div>
            </div>
        </div>
    );
}

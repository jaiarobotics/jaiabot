import "./MeasurePanel.less";

/**
 * Displays the distance measured from the measure tool
 */
export default function MeasurePanel() {
    return (
        <div className="jaia-panel measure-panel">
            <div className="jaia-panel-title">Measure</div>
            <div className="distance-container">
                <div>Distance:</div>
                <div>250 meters</div>
            </div>
        </div>
    );
}

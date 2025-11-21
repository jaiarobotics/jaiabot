import JaiaToggle from "../../JaiaToggle/JaiaToggle";
import "./MoveHub.less";

export default function MoveHub() {
    return (
        <div className="move-hub">
            <div className="heading">Move Hub</div>
            <div className="toggle-container">
                <div>Select on Map:</div>
                <JaiaToggle checked={() => true} onClick={() => {}} />
            </div>
            <div className="location-input-container">
                <div>Lat:</div>
                <input className="jaia-input" />
                <div>Lon:</div>
                <input className="jaia-input" />
            </div>
        </div>
    );
}

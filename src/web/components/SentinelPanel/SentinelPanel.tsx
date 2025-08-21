import { Track } from "../../types/protobuf-types";
import "./SentinelPanel.less";

interface Props {
    track: Track;
}

export default function SentinelPanel(props: Props) {
    return (
        <div className="jaia-panel sentinel-panel">
            <div className="jaia-panel-title">Track {props.track.id}</div>
            <div className="track-data-container">
                <div className="label">Age:</div>
                <div>{props.track?.age?.toFixed(0)}</div>

                <div className="label">Track State:</div>
                <div>{props.track?.track_state}</div>

                <div className="label">Alert State:</div>
                <div>{props.track?.alert_state}</div>

                <div className="label">Lat:</div>
                <div>{props.track?.location?.lat?.toFixed(5)}</div>

                <div className="label">Lon:</div>
                <div>{props.track?.location?.lon?.toFixed(5)}</div>

                <div className="label">Speed:</div>
                <div>{props.track?.speed?.toFixed(2)}</div>

                <div className="label">Heading:</div>
                <div>{props.track?.heading?.toFixed(0)}</div>
            </div>
        </div>
    );
}

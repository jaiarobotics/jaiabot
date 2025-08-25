import { useState } from "react";
import { jaiaAPI } from "../../utils/jaia-api";
import { BotsToIntercept, Track } from "../../types/protobuf-types";
import "./SentinelPanel.less";

interface Props {
    track: Track;
}

export default function SentinelPanel(props: Props) {
    const [selectedBotIDs, setSelectedBotIDs] = useState(new Map<number, boolean>());

    const handleBotClick = (botID: number) => {
        if (selectedBotIDs.has(botID)) {
            selectedBotIDs.delete(botID);
        } else {
            selectedBotIDs.set(botID, true);
        }
        setSelectedBotIDs(new Map(selectedBotIDs));
    };

    const getClassName = (botID: number) => {
        if (selectedBotIDs.has(botID)) {
            return "selected";
        }
    };

    const sendBotsToIntercept = async () => {
        const botsToIntercept: BotsToIntercept = {
            track_id: props.track.id,
            bot_ids: Array.from(selectedBotIDs.keys()),
            initiated: false,
        };
        const res = await jaiaAPI.postBotsToIntercept(botsToIntercept);
    };

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
            <div className="bot-select-container">
                <button className={getClassName(1)} onClick={() => handleBotClick(1)}>
                    Bot 1
                </button>
                <button className={getClassName(2)} onClick={() => handleBotClick(2)}>
                    Bot 2
                </button>
                <button className={getClassName(3)} onClick={() => handleBotClick(3)}>
                    Bot 3
                </button>
                <button className={getClassName(4)} onClick={() => handleBotClick(4)}>
                    Bot 4
                </button>
            </div>
            <div className="action-buttons-container">
                <button>Close</button>
                <button onClick={() => sendBotsToIntercept()}>Go</button>
            </div>
        </div>
    );
}

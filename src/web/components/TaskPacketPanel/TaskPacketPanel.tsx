import { useContext, useEffect } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { TaskPacket } from "../../types/protobuf-types";
import { PanelActions, TaskPacketVisibility } from "../../types/context-types";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { SelectedTaskPacket } from "../../types/jaia-system-types";
import { jaiaAPI } from "../../utils/jaia-api";

import "./TaskPacketPanel.less";

interface Props {
    selectedTaskPacket?: SelectedTaskPacket;
    taskPackets?: TaskPacket[];
    taskPacketID?: string;
}

/**
 * Displays task packet data to the operator in a tabular format
 */
export default function TaskPacketPanel(props: Props) {
    /**
     * Retrieves the data associated with the selected task packet
     *
     * @returns {TaskPacket}
     */
    const getTaskPacket = () => {
        for (const taskPacket of props.taskPackets) {
            if (
                taskPacket.start_time === props.selectedTaskPacket.startTime &&
                taskPacket.bot_id === props.selectedTaskPacket.botID
            ) {
                return taskPacket;
            }
        }
    };

    const getTaskPacketID = (taskPacket: TaskPacket) => {
        const startTimeSeconds = Math.round(taskPacket.start_time / 1e6);
        return `${taskPacket.bot_id}_${startTimeSeconds}`;
    };

    /**
     * Coverts the timestamp to a human readable date string
     *
     * @param {number} timestamp Timestamp in miliseconds
     * @returns {string} Date in the format: hh::mm MM/DD/YYYY
     */
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp / 1_000);
        return `${date.getHours()}:${date.getMinutes()} ${date.getMonth()}/${date.getDay()}/${date.getFullYear()}`;
    };

    const jaiaDispatch = useContext(JaiaDispatchContext);

    useEffect(() => {
        return () => {
            jaiaDispatch({ type: JaiaActions.CLOSED_TASK_PACKET_PANEL });
        };
    }, []);

    /**
     * Dispatches action to close panel
     *
     * @returns {void}
     */
    const handleCloseClick = () => {
        jaiaDispatch({
            type: JaiaActions.CLOSED_TASK_PACKET_PANEL,
            panelAction: PanelActions.CLOSE,
        });
    };

    const taskPacket = getTaskPacket();
    const startTime = formatDate(taskPacket.start_time);
    const endTime = formatDate(taskPacket.end_time);

    switch (props.selectedTaskPacket.type) {
        case MapFeatureTypes.DIVE:
            return (
                <div className="task-packet-panel-container">
                    <div className="task-packet-panel">
                        <div className="label">Bot</div>
                        <div>{taskPacket.bot_id}</div>
                        <div className="line-break"></div>
                        <div className="label">Depth Achieved:</div>
                        <div>{taskPacket.dive.depth_achieved} m</div>
                        <div className="line-break"></div>
                        <div className="label">Dive Rate:</div>
                        <div>{taskPacket.dive.dive_rate} m/s</div>
                        <div className="line-break"></div>
                        <div className="label">Bottom Dive:</div>
                        <div>{taskPacket.dive.bottom_dive ? "Yes" : "No"}</div>
                        <div className="line-break"></div>
                        <div className="label">Start Time:</div>
                        <div>{startTime}</div>
                        <div className="line-break"></div>
                        <div className="label">End Time:</div>
                        <div>{endTime}</div>
                    </div>
                    <VisibilityButtons taskPacketID={getTaskPacketID(taskPacket)} />
                    <button onClick={() => handleCloseClick()}>Close</button>
                </div>
            );

        case MapFeatureTypes.DRIFT:
            return (
                <div className="task-packet-panel-container">
                    <div className="task-packet-panel">
                        <div className="label">Bot ID:</div>
                        <div>{taskPacket.bot_id}</div>
                        <div className="line-break"></div>
                        <div className="label">Duration:</div>
                        <div>{taskPacket.drift.drift_duration} s</div>
                        <div className="line-break"></div>
                        <div className="label">Speed:</div>
                        <div>{taskPacket.drift.estimated_drift.speed} m/s</div>
                        <div className="line-break"></div>
                        <div className="label">Direction:</div>
                        <div>{taskPacket.drift.estimated_drift.heading} deg</div>
                        <div className="line-break"></div>
                        <div className="label">
                            Sig Wave Height<br></br>Beta:
                        </div>
                        <div>{taskPacket.drift.significant_wave_height} m</div>
                        <div className="line-break"></div>
                        <div className="label">Start Time:</div>
                        <div>{startTime}</div>
                        <div className="line-break"></div>
                        <div className="label">End Time:</div>
                        <div>{endTime}</div>
                    </div>
                    <VisibilityButtons taskPacketID={getTaskPacketID(taskPacket)} />
                    <button onClick={() => handleCloseClick()}>Close</button>
                </div>
            );
    }
}

function VisibilityButtons(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const excludeTaskPacket = () => {
        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PACKET_VISIBILITY,
            taskPacketVisibility: TaskPacketVisibility.EXCLUDE,
            taskPacketID: props.taskPacketID,
        });
    };

    const includeTaskPacket = () => {
        jaiaAPI.postTaskPacketInclude(props.taskPacketID, true);
    };

    return (
        <div className="visibility-buttons">
            <button onClick={() => excludeTaskPacket()}>Exclude</button>
            <button onClick={() => includeTaskPacket()}>Include</button>
        </div>
    );
}

import { useContext, useEffect, useMemo, useState } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { TaskPackets } from "../../data/task_packets/task-packets";
import { TaskPacket } from "../../shared/proto/jaiabot/messages/jaia_dccl";
import { PanelActions, TaskPacketVisibility } from "../../types/context-types";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { SelectedTaskPacket } from "../../types/jaia-system-types";

import "./TaskPacketPanel.less";

interface Props {
    selectedTaskPacket?: SelectedTaskPacket;
    taskPackets?: TaskPackets;
    taskPacketID?: string;
}

const DECIMALS = 2;

/**
 * Displays task packet data to the operator in a tabular format
 */
export default function TaskPacketPanel(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [prevSelected, setPrevSelected] = useState({ ...props.selectedTaskPacket });

    const getTaskPacket = () => {
        return props.taskPackets.getTaskPacket(
            props.selectedTaskPacket.botID,
            props.selectedTaskPacket.startTime,
        );
    };

    const taskPacket = useMemo(() => getTaskPacket(), [prevSelected]);

    useEffect(() => {
        if (
            prevSelected.botID !== props.selectedTaskPacket.botID ||
            prevSelected.startTime !== props.selectedTaskPacket.startTime ||
            prevSelected.type !== props.selectedTaskPacket.type
        ) {
            setPrevSelected({ ...props.selectedTaskPacket });
        }
    });

    /**
     * Gets the ID used by the server for querying task packet data
     *
     * @param {TaskPacket} taskPacket Selected task packet
     * @returns {string} "botid_startTimeSeconds"
     */
    const getTaskPacketID = (taskPacket: TaskPacket) => {
        const startTimeSeconds = Math.round(Number(taskPacket.start_time) / 1e6);
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
        const minutes = date.getMinutes();
        const minutesFormated = minutes < 10 ? `0${minutes}` : minutes;
        return `${date.getHours()}:${minutesFormated} ${date.getMonth()}/${date.getDay()}/${date.getFullYear()}`;
    };

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

    const startTime = formatDate(Number(taskPacket.start_time));
    const endTime = formatDate(Number(taskPacket.end_time));

    // We use the guards because props.selectedTaskPacket is one step
    // ahead of the taskPacket variable when a task icon is clicked
    switch (props.selectedTaskPacket.type) {
        case MapFeatureTypes.DIVE:
            if (!taskPacket.dive) {
                return;
            }
            return (
                <div className="task-packet-panel-container">
                    <div className="task-packet-panel">
                        <div className="label">Bot</div>
                        <div>{taskPacket.bot_id}</div>
                        <div className="line-break"></div>
                        <div className="label">Depth Achieved:</div>
                        <div>{taskPacket.dive.depth_achieved.toFixed(DECIMALS) ?? ""} m</div>
                        <div className="line-break"></div>
                        <div className="label">Dive Rate:</div>
                        <div>{taskPacket.dive.dive_rate.toFixed(DECIMALS) ?? ""} m/s</div>
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
            if (!taskPacket.drift || !taskPacket.drift.estimated_drift) {
                return;
            }
            return (
                <div className="task-packet-panel-container">
                    <div className="task-packet-panel">
                        <div className="label">Bot ID:</div>
                        <div>{taskPacket.bot_id}</div>
                        <div className="line-break"></div>
                        <div className="label">Duration:</div>
                        <div>{taskPacket.drift.drift_duration.toFixed(DECIMALS) ?? ""} s</div>
                        <div className="line-break"></div>
                        <div className="label">Speed:</div>
                        <div>
                            {taskPacket.drift.estimated_drift.speed.toFixed(DECIMALS) ?? ""} m/s
                        </div>
                        <div className="line-break"></div>
                        <div className="label">Direction:</div>
                        <div>
                            {taskPacket.drift.estimated_drift.heading.toFixed(DECIMALS) ?? ""} deg
                        </div>
                        <div className="line-break"></div>
                        <div className="label">
                            Sig Wave Height<br></br>Beta:
                        </div>
                        <div>
                            {taskPacket.drift.significant_wave_height.toFixed(DECIMALS) ?? ""} m
                        </div>
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

/**
 * Renders the exclude + include buttons for task packets
 */
function VisibilityButtons(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches action to remove or bring back task packet
     *
     * @param {TaskPacketVisibility} taskPacketVisibility Name of the clicked button
     * @returns {void}
     */
    const handleClick = (taskPacketVisibility: TaskPacketVisibility) => {
        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PACKET_VISIBILITY,
            taskPacketVisibility: taskPacketVisibility,
            taskPacketID: props.taskPacketID,
        });
    };

    return (
        <div className="visibility-buttons">
            <button onClick={() => handleClick(TaskPacketVisibility.EXCLUDE)}>Exclude</button>
            <button onClick={() => handleClick(TaskPacketVisibility.INCLUDE)}>Include</button>
        </div>
    );
}

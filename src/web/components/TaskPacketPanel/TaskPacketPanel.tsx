import { useContext, useEffect, useMemo } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { TaskPacket } from "../../types/protobuf-types";
import { SelectedTaskMarker } from "../../types/jaia-system-types";

import "./TaskPacketPanel.less";

interface Props {
    selectedTaskMarker: SelectedTaskMarker;
    taskPackets: TaskPacket[];
}

export default function TaskPacketPanel(props: Props) {
    const getTaskPacket = () => {
        for (const taskPacket of props.taskPackets) {
            if (
                taskPacket.start_time === props.selectedTaskMarker.startTime &&
                taskPacket.bot_id === props.selectedTaskMarker.botID
            ) {
                return taskPacket;
            }
        }
    };

    // Milliseconds
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp / 1_000);
        return `${date.getHours()}:${date.getMinutes()} ${date.getMonth()}/${date.getDay()}/${date.getFullYear()}`;
    };

    const jaiaDispatch = useContext(JaiaDispatchContext);

    const taskPacket = useMemo(() => getTaskPacket(), []);
    const startTime = useMemo(() => formatTime(taskPacket.start_time), []);
    const endTime = useMemo(() => formatTime(taskPacket.end_time), []);

    useEffect(() => {
        return () => {
            jaiaDispatch({ type: JaiaActions.CLOSED_TASK_PACKET_PANEL });
        };
    }, []);

    if (taskPacket.dive) {
        return (
            <div className="task-packet-panel-container">
                <div className="task-packet-panel">
                    <div className="label">Bot ID:</div>
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
            </div>
        );
    }
}

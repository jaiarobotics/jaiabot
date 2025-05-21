import React from "react";
import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import { PanelType } from "../CommandControl/CommandControl";
import "./TaskPacketPanel.less";
import { jaiaAPI } from "../../utils/jaia-api";
import { Button } from "@mui/material";
import { TaskPacket } from "../../shared/JAIAProtobuf";

interface Props {
    type: string;
    selectedTaskPacket: TaskPacket;
    setVisiblePanel: (panelType: PanelType) => void;
    pollTaskPackets: () => void;
}

function getTaskPacketId(task_packet: TaskPacket) {
    const start_time_seconds = Math.round(task_packet.start_time / 1e6);
    return `${task_packet.bot_id}_${start_time_seconds}`;
}

export function TaskPacketPanel(props: Props) {
    const task_packet = props.selectedTaskPacket;

    // TODO: Probably want to refactor this into a type with optional name, value, units
    var taskPacketData: { [key: string]: { [key: string]: string } };

    if (props.type == "dive") {
        const dive = task_packet.dive;
        const startTime = new Date(task_packet.start_time / 1000);
        const endTime = new Date(task_packet.end_time / 1000);
        taskPacketData = {
            // Snake case used for string parsing in task packet panel
            bot_id: { value: task_packet.bot_id.toString(), units: "" },
            depth_achieved: { value: dive.depth_achieved.toFixed(2), units: "m" },
            dive_rate: { value: dive.dive_rate.toFixed(2), units: "m/s" },
            bottom_dive: { value: dive.bottom_dive ? "Yes" : "No", units: "" },
            start_time: { value: startTime.toLocaleString(), units: "" },
            end_time: { value: endTime.toLocaleString(), units: "" },
        };
    } else if (props.type == "drift") {
        const drift = task_packet.drift;
        const startTime = new Date(task_packet.start_time / 1000);
        const endTime = new Date(task_packet.end_time / 1000);
        taskPacketData = {
            // Snake case used for string parsing in task packet panel
            bot_id: { value: task_packet.bot_id.toString(), units: "" },
            duration: { value: drift.drift_duration.toFixed(2), units: "s" },
            speed: { value: drift.estimated_drift?.speed?.toFixed(2) ?? "?", units: "m/s" },
            drift_direction: {
                value: drift.estimated_drift?.heading?.toFixed(2) ?? "?",
                units: "deg",
            },
            sig_wave_height_beta: { value: drift.significant_wave_height.toFixed(2), units: "m" },
            start_time: { value: startTime.toLocaleString(), units: "" },
            end_time: { value: endTime.toLocaleString(), units: "" },
        };
    } else {
        console.warn(`Unknown task packet type: ${props.type}`);
        return <div></div>;
    }

    const taskPacketArray: { [key: string]: string }[] = [];
    const taskPacketKeys = Object.keys(taskPacketData);
    const taskPacketValues = Object.values(taskPacketData);
    for (let i = 0; i < taskPacketKeys.length; i++) {
        taskPacketArray.push({ type: "key", val: taskPacketKeys[i] });
        taskPacketArray.push({ type: "value", val: taskPacketValues[i].value });
        taskPacketArray.push({ type: "units", val: taskPacketValues[i].units });
        taskPacketArray.push({ type: "line-break" });
    }

    const title = `${props.type.slice(0, 1).toUpperCase()}${props.type.slice(1)} Packet`;

    function includeTaskPacket() {
        const task_packet_id = getTaskPacketId(task_packet);
        jaiaAPI.postTaskPacketInclude(task_packet_id, true).then((response) => {
            props.pollTaskPackets();
        });
    }

    function excludeTaskPacket() {
        const task_packet_id = getTaskPacketId(task_packet);
        jaiaAPI.postTaskPacketInclude(task_packet_id, false).then((response) => {
            props.pollTaskPackets();
        });
    }

    return (
        <div className="task-packet-panel-base-grid">
            <div className="task-packet-layout-container">
                <div
                    className="task-packet-close-btn"
                    onClick={() => {
                        props.setVisiblePanel(PanelType.NONE);
                    }}
                >
                    <Icon path={mdiClose} size={1} />
                </div>
                <div className="task-packet-outer-container">
                    <div className="task-packet-title">{title}</div>
                    <div className="task-packet-panel-container">
                        {taskPacketArray.map((item, index) => {
                            if (item.type === "key") {
                                const labelSplit = item.val.split("_");
                                const firstLetterUpper = labelSplit.map(
                                    (word) => word.slice(0, 1).toUpperCase() + word.slice(1),
                                );
                                let label = firstLetterUpper.join(" ");
                                if (label === "Sig Wave Height Beta") {
                                    label = "Sig Wave Height (Beta)";
                                }
                                return (
                                    <div className="task-packet-label" key={index}>
                                        {label}:
                                    </div>
                                );
                            } else if (item.type === "value") {
                                return (
                                    <div className="task-packet-input" key={index}>
                                        {item.val}
                                    </div>
                                );
                            } else if (item.type === "units") {
                                return (
                                    <div className="task-packet-units" key={index}>
                                        {item.val}
                                    </div>
                                );
                            }
                            return <div className="task-packet-line-break" key={index}></div>;
                        })}
                        <Button onClick={includeTaskPacket}>Include</Button>
                        <Button onClick={excludeTaskPacket}>Exclude</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

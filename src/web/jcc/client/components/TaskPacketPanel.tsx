import React from "react";
import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import { PanelType } from "./CommandControl/CommandControl";
import "../style/components/TaskPacketPanel.css";

interface Props {
    type: string;
    taskPacketData: { [key: string]: { [key: string]: string } };
    setVisiblePanel: (panelType: PanelType) => void;
}

export function TaskPacketPanel(props: Props) {
    let taskPacketData = props.taskPacketData;
    delete taskPacketData?.title;

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
                        {taskPacketArray.map((item) => {
                            if (item.type === "key") {
                                const labelSplit = item.val.split("_");
                                const firstLetterUpper = labelSplit.map(
                                    (word) => word.slice(0, 1).toUpperCase() + word.slice(1),
                                );
                                let label = firstLetterUpper.join(" ");
                                if (label === "Sig Wave Height Beta") {
                                    label = "Sig Wave Height (Beta)";
                                }
                                return <div className="task-packet-label">{label}:</div>;
                            } else if (item.type === "value") {
                                return <div className="task-packet-input">{item.val}</div>;
                            } else if (item.type === "units") {
                                return <div className="task-packet-units">{item.val}</div>;
                            }
                            return <div className="task-packet-line-break"></div>;
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

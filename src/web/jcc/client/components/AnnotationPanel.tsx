import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import { PanelType } from "./CommandControl/CommandControl";
import "../style/components/TaskPacketPanel.css";
import { Feature } from "ol";

interface Props {
    annotation: Feature;
    setVisiblePanel: (panelType: PanelType) => void;
}

/**
 * The panel that comes up when user clicks on a user-submitted annotation.
 *
 * @param {Props} props
 * @returns {*} The React panel.
 */
export function AnnotationPanel(props: Props) {
    let annotation = props.annotation;
    const data: { [key: string]: number } = annotation.get("data") ?? {};

    const taskPacketArray: { [key: string]: string }[] = [];
    const taskPacketKeys = Object.keys(data);
    const taskPacketValues = Object.values(data);
    for (let i = 0; i < taskPacketKeys.length; i++) {
        taskPacketArray.push({ type: "key", val: taskPacketKeys[i] });
        taskPacketArray.push({ type: "value", val: `${taskPacketValues[i]}` });
        taskPacketArray.push({ type: "line-break", val: String(i) });
    }

    const title = annotation.get("title");

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
                                return (
                                    <div className="task-packet-label" key={label}>
                                        {label}:
                                    </div>
                                );
                            } else if (item.type === "value") {
                                return (
                                    <div className="task-packet-input" key={item.val}>
                                        {item.val}
                                    </div>
                                );
                            }
                            return <div className="task-packet-line-break" key={item.val}></div>;
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

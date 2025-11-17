import React, { useEffect } from "react";
import "./InformationDialog.css";
import { LogApi } from "../model/LogApi";
import { DeviceMetadata } from "../shared/JAIAProtobuf";
import { set } from "lodash";

interface Props {
    logFiles: string[];
    onClose: () => void;
}

const METADATA_PATH = "jaiabot::metadata/jaiabot.protobuf.DeviceMetadata";

export function InformationDialog(props: Props) {
    const [dialogText, setDialogText] = React.useState("Loading metadata...");

    useEffect(() => {
        LogApi.getObjects<DeviceMetadata>(props.logFiles, METADATA_PATH)
            .then((metadata) => {
                if (metadata.length === 0) {
                    setDialogText("No metadata found in the selected logs.");
                    return;
                } else {
                    setDialogText(JSON.stringify(metadata[0], null, 2));
                }
            })
            .catch((error) => {
                setDialogText(`Error loading metadata: ${error.message}`);
            });

        // Cleanup function runs when the component is unmounted
        return () => {};
    }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

    return (
        <div id="informationDialog" className="centered shadowed rounded padded">
            <h2>Log Metadata</h2>
            <pre id="informationDialogText">{dialogText}</pre>
            <button className="padded" onClick={props.onClose}>
                Close
            </button>
        </div>
    );
}

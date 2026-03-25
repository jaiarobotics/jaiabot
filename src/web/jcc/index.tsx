import * as ReactDOM from "react-dom/client";
import App from "./App";
import {
    DATA_MODEL_POLL_TIME,
    GITHUB_POLL_TIME,
    METADATA_POLL_TIME,
    TASK_PACKET_POLL_TIME,
} from "../utils/constants";
import { pollGitHub, pollMetadata, pollStatus, pollTaskPackets } from "./polling";

// Make initial calls
pollStatus();
pollTaskPackets();
pollMetadata();
pollGitHub();

// Start intervals
const statusInterval = setInterval(async () => pollStatus(), DATA_MODEL_POLL_TIME);
const taskPacketInterval = setInterval(async () => pollTaskPackets(), TASK_PACKET_POLL_TIME);
const metadataInterval = setInterval(async () => pollMetadata(), METADATA_POLL_TIME);
const gitHubInterval = setInterval(async () => pollGitHub(), GITHUB_POLL_TIME);

let element = document.getElementById("root");
const root = ReactDOM.createRoot(element);
root.render(<App />);

module.hot.accept();

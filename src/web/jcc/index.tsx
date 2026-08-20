import * as ReactDOM from "react-dom/client";
import App from "./App";
import {
    BATTERY_PREDICTION_POLL_TIME,
    DATA_MODEL_POLL_TIME,
    GITHUB_POLL_TIME,
    INTERNET_POLL_TIME,
    METADATA_POLL_TIME,
    TASK_PACKET_POLL_TIME,
} from "../utils/constants";
import {
    pollBatteryPredictions,
    pollGitHub,
    pollInternet,
    pollMetadata,
    pollStatus,
    pollTaskPackets,
} from "./polling";

// Make initial calls
pollStatus();
pollTaskPackets();
pollMetadata();
pollGitHub();
pollInternet();
pollBatteryPredictions();

// Start intervals
const statusInterval = setInterval(async () => pollStatus(), DATA_MODEL_POLL_TIME);
const taskPacketInterval = setInterval(async () => pollTaskPackets(), TASK_PACKET_POLL_TIME);
const metadataInterval = setInterval(async () => pollMetadata(), METADATA_POLL_TIME);
const gitHubInterval = setInterval(async () => pollGitHub(), GITHUB_POLL_TIME);
const internetInterval = setInterval(async () => pollInternet(), INTERNET_POLL_TIME);
const batteryPredictionInterval = setInterval(
    async () => pollBatteryPredictions(),
    BATTERY_PREDICTION_POLL_TIME,
);

let element = document.getElementById("root");
const root = ReactDOM.createRoot(element);
root.render(<App />);

// Prefetch Plotly in the background immediately after app renders.
// It is only used by DepthMap3D but we want it ready before the user opens that panel.
// @ts-ignore - plotly.js-dist has no type declarations
import(/* webpackPrefetch: true */ "plotly.js-dist");

import.meta.webpackHot?.accept();

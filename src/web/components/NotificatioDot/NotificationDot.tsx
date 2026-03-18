import { useContext, useEffect } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import { Version } from "../../types/protobuf-types";
import "./NotificationDot.less";

const GITHUB_POLL_INTERVAL = 10_000;
const JAIA_GITHUB_REPO_URL = "https://api.github.com/repos/jaiarobotics/jaiabot/releases/latest";
const VERSION_LENGTH = 3;

enum NotificationColors {
    NONE = "none",
    RED = "red",
    GREEN = "green",
    YELLOW = "yellow",
}

const gitHubVersion: Version = {
    major: "",
    minor: "",
    patch: "",
};

let internetConnected = false;
let upgradeAvailable = false;
let color = NotificationColors.NONE;

export default function NotificationDot() {
    const jaiaContext = useContext(JaiaContext);

    useEffect(() => {
        queryGitHub();
        startGitHubPoll();
    }, []);

    if (!jaiaContext) {
        return;
    }

    upgradeAvailable = compareVersions(jaiaContext.jaiaGlobal.getMetadata()?.jaiabot_version);

    if (!internetConnected) {
        color = NotificationColors.YELLOW;
    }

    if (internetConnected && upgradeAvailable) {
        // Dispatch upgrade available
        color = NotificationColors.RED;
    }

    if (internetConnected && !upgradeAvailable) {
        return;
    }

    return <div className={`notification-dot ${color}`}></div>;
}

function startGitHubPoll() {
    setInterval(async () => queryGitHub(), GITHUB_POLL_INTERVAL);
}

async function queryGitHub() {
    try {
        const response = await fetch(JAIA_GITHUB_REPO_URL);
        const json = await response.json();
        if (json.tag_name) {
            deconstructTagName(json.tag_name);
        }
        internetConnected = true;
    } catch (e) {
        console.error("Unable to retrieve version from GitHub");
        internetConnected = false;
    }
}

function deconstructTagName(tagName: string) {
    if (tagName) {
        const version = tagName.split(".");
        if (version.length === VERSION_LENGTH) {
            gitHubVersion.major = version[0];
            gitHubVersion.minor = version[1];
            gitHubVersion.patch = version[2];
        }
    }
}

function compareVersions(currentVersion: Version) {
    if (!currentVersion) {
        return false;
    }

    if (gitHubVersion.major === "") {
        return false;
    }

    if (parseInt(gitHubVersion.major) > parseInt(currentVersion.major)) {
        return true;
    }

    if (parseInt(gitHubVersion.minor) > parseInt(currentVersion.minor)) {
        return true;
    }

    if (parseInt(gitHubVersion.patch) > parseInt(currentVersion.patch)) {
        return true;
    }

    return false;
}

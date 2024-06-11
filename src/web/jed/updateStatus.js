import { byId } from "./domQuery.js";

// Updates the status element with a status response object
function updateStatus(status) {
    const bots = status["bots"];
    const hubs = status["hubs"];

    // For now we just handle one hub
    const hub = hubs[0];

    const table = byId("statusTable");
    var innerHTML =
        "<tr><th>Bot ID</th><th>Mission State</th><th>Latitude (°)</th><th>Longitude (°)</th><th>Distance (m)</th><th>Depth (m)</th><th>Ground Speed (m/s)</th><th>Course Over Ground (°)</th><th>Heading (°)</th><th>Pitch (°)</th><th>Roll (°)</th><th>Temperature (℃)</th><th>Salinity (PSU(ppt))</th><th>Vcc Voltage (V)</th><th>Vcc Current (A)</th><th>5V Current (A)</th><th>Status Age (s)</th><th>Command Age (s)</th></tr>";
    var loggingStatusInnerUp = "<label style='color:black; display: inline-block;'>Bots: ";
    var loggingStatusInnerDown = "<label style='color:red; display: inline-block;'>Bots: ";
    var loggingStatusInner = "";
    var isLogging = false;
    var isNotLogging = false;

    let now_us = Date.now() * 1e3;

    var loggingStatus = byId("loggingStatus");

    for (const [botId, bot] of Object.entries(bots)) {
        // Alert user that data is not being logged
        if (
            bot.missionState == "PRE_DEPLOYMENT__IDLE" ||
            bot.missionState == "POST_DEPLOYMENT__IDLE"
        ) {
            loggingStatusInnerDown += bot.bot_id + ", ";
            isNotLogging = true;
        } else {
            loggingStatusInnerUp += bot.bot_id + ", ";
            isLogging = true;
        }

        innerHTML += "<tr>";
        innerHTML += "<td>" + bot.bot_id + "</td>";

        innerHTML += "<td>" + bot.mission_state + "</td>";

        let bot_location = bot.location || null;
        let hub_location = hub?.location || null;
        innerHTML += "<td>" + (bot.location?.lat?.toFixed(6) || "❌") + "</td>";
        innerHTML += "<td>" + (bot.location?.lon?.toFixed(6) || "❌") + "</td>";

        const d = latlon_distance(bot_location, hub_location);
        innerHTML += "<td>" + d?.toFixed(1) || "?" + "</td>";

        innerHTML += "<td>" + (bot.depth?.toFixed(1) || "?") + "</td>";

        innerHTML += "<td>" + (bot.speed?.over_ground?.toFixed(1) || "?") + "</td>";
        innerHTML += "<td>" + (bot.attitude?.course_over_ground?.toFixed(1) || "?") + "</td>";
        innerHTML += "<td>" + (bot.attitude?.heading?.toFixed(1) || "?") + "</td>";
        innerHTML += "<td>" + (bot.attitude?.pitch?.toFixed(1) || "?") + "</td>";
        innerHTML += "<td>" + (bot.attitude?.roll?.toFixed(1) || "?") + "</td>";

        innerHTML += "<td>" + (bot.temperature?.toFixed(1) || "?") + "</td>";

        innerHTML += "<td>" + (bot.salinity?.toFixed(1) || "?") + "</td>";

        innerHTML += "<td>" + (bot.vcc_voltage?.toFixed(1) || "?") + "</td>";
        innerHTML += "<td>" + (bot.vcc_current?.toFixed(1) || "?") + "</td>";
        innerHTML += "<td>" + (bot.vv_current?.toFixed(1) || "?") + "</td>";

        innerHTML += "<td>" + Math.max(0.0, bot.portalStatusAge / 1e6).toFixed(0) + "</td>";

        const lastCommandTime = bot.last_command_time
            ? ((now_us - bot.last_command_time) / 1e6).toFixed(0)
            : "";
        innerHTML += "<td>" + lastCommandTime + "</td>";

        innerHTML += "</tr>";
    }
    loggingStatusInnerUp += "Logging Status: Logging</label>";
    loggingStatusInnerDown += "Logging Status: Not Logging (Activate For Logging)</label>";

    if (isNotLogging && isLogging) {
        loggingStatusInner = loggingStatusInnerDown + "<br>" + loggingStatusInnerUp;
    } else if (isNotLogging && !isLogging) {
        loggingStatusInner = loggingStatusInnerDown;
    } else {
        loggingStatusInner = loggingStatusInnerUp;
    }

    loggingStatus.innerHTML = loggingStatusInner;
    table.innerHTML = innerHTML;
}

// Calculate xyz position of lat/lon point
function xyz(pt) {
    const deg = 3.14159265358 / 180.0;
    const r_e = 6.3781e6;
    return [
        r_e * Math.cos(pt.lon * deg) * Math.sin(pt.lat * deg),
        r_e * Math.sin(pt.lon * deg) * Math.sin(pt.lat * deg),
        r_e * Math.cos(pt.lat * deg),
    ];
}

// Calculate Euclidean distance
function distance(x, y) {
    return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
}

// Calculate distance between two lat/lon points
function latlon_distance(pt1, pt2) {
    if (!pt1 || !pt2) {
        return undefined;
    }

    const xyz1 = xyz(pt1);
    const xyz2 = xyz(pt2);
    return distance(xyz1, xyz2);
}

export { updateStatus };

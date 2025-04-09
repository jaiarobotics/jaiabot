import React from "react";
import "./HelpWindow.less";
import Icon from "@mdi/react";
import Button from "@mui/material/Button";
import {
    mdiPlay,
    mdiWindowClose,
    mdiCheckboxMarkedCirclePlusOutline,
    mdiArrowULeftTop,
    mdiStop,
    mdiViewList,
    mdiDownloadMultiple,
    mdiProgressDownload,
    mdiCog,
    mdiSquareEditOutline,
    mdiRuler,
    mdiRotate3dVariant,
    mdiMagnifyPlusOutline,
    mdiMagnifyMinusOutline,
    mdiPower,
    mdiRestartAlert,
    mdiRestart,
    mdiChartLine,
    mdiWifiCog,
    mdiWrenchCog,
    mdiController,
    mdiSkipNext,
    mdiDownload,
    mdiDelete,
} from "@mdi/js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
const rallyIcon = require("../../shared/rally.svg") as string;

interface ButtonDescriptor {
    imgSrc?: string;
    iconPath?: string;
    fontAwesomeIconDefinition?: IconDefinition;
    iconStyle?: { [key: string]: any };
    name: string;
    description: string;
}

function getButtonRow(descriptor: ButtonDescriptor) {
    var buttonContents;

    if (descriptor.imgSrc) {
        buttonContents = <img src={descriptor.imgSrc}></img>;
    } else if (descriptor.iconPath) {
        buttonContents = <Icon path={descriptor.iconPath} title={descriptor.name} />;
    } else if (descriptor.fontAwesomeIconDefinition) {
        buttonContents = (
            <FontAwesomeIcon icon={descriptor.fontAwesomeIconDefinition} title={descriptor.name} />
        );
    }

    return (
        <tr>
            <td className="button-image">
                <Button className="button-jcc" style={descriptor.iconStyle}>
                    {buttonContents}
                </Button>
            </td>
            <td className="button-name">{descriptor.name}</td>
            <td className="button-description">{descriptor.description}</td>
        </tr>
    );
}

const buttons: ButtonDescriptor[] = [
    //here
    {
        iconPath: mdiCheckboxMarkedCirclePlusOutline,
        name: "System Check All Bots",
        description:
            "Run a system check on all bots in the pod.  Missions can only be run after the system check completes successfully.",
    },
    {
        iconPath: mdiStop,
        iconStyle: { backgroundColor: "#cc0505" },
        name: "Stop All Missions",
        description: "Order all bots to stop their currently running missions.",
    },
    {
        iconPath: mdiPlay,
        name: "Run Mission",
        description: "Run the mission as currently edited on the map.",
    },
    {
        iconPath: mdiDownloadMultiple,
        name: "Download All",
        description: "Start downloading log and sensor data from all of the bots to the hub.",
    },
    {
        iconPath: mdiArrowULeftTop,
        name: "Undo",
        description: "Undo the last 10 mission planning actions (excluding Task modifications).",
    },
    {
        iconPath: mdiViewList,
        name: "Mission Panel",
        description:
            "Open the Mission Panel, which shows each run in the current mission, along with the bots assigned to each run. Bots can be auto-assigned to runs automatically. Missions can also be saved, loaded, and cleared from this panel",
    },
    {
        imgSrc: rallyIcon,
        name: "Add Rally Point",
        description: "Add a rally point that can be used at the start or end of a survey mission.",
    },
    {
        iconPath: mdiSquareEditOutline,
        name: "Edit Optimized Mission Survey",
        description:
            "Open the Optimized Mission Survey, which can be used to configure a survey mission, where the pod of Jaiabots will coordinate to survey an area of the map.  The tasks performed at each waypoint in the survey mission can be customized.",
    },
    {
        iconPath: mdiProgressDownload,
        name: "Download Queue",
        description:
            "Open the Download Queue panel, which shows the currently queued data downloads from the bots to the hub.",
    },
    {
        iconPath: mdiRuler,
        name: "Measure Distance",
        description:
            "Click two or more points to measure the total distance along a set of line segments.",
    },
    {
        iconPath: mdiCog,
        name: "Settings",
        description: "Open the Settings panel for Jaia Command & Control.",
    },
    {
        iconPath: mdiRotate3dVariant,
        name: "Reset rotation",
        description: "When using tablet, click to reset rotation of the map.",
    },
    {
        iconPath: mdiMagnifyPlusOutline,
        name: "Zoom in",
        description: "Increase the map's magnification.",
    },
    {
        iconPath: mdiMagnifyMinusOutline,
        name: "Zoom out",
        description: "Decrease the map's magnification.",
    },
    //here
    {
        iconPath: mdiPower,
        name: "Shutdown",
        description: "Shutdowns the system for the Hub.",
    },
    {
        iconPath: mdiRestartAlert,
        name: "Reboot",
        description: "Reboots the Hub.",
    },
    {
        iconPath: mdiRestart,
        name: "Restart",
        description: "Restart the Hub.",
    },
    {
        iconPath: mdiChartLine,
        name: "test",
        description: "test",
    },
    {
        iconPath: mdiWifiCog,
        name: "test",
        description: "test",
    },
    {
        iconPath: mdiWrenchCog,
        name: "Upgrade",
        description: "test",
    },
    //here
    {
        iconPath: mdiStop,
        name: "Stop",
        description: "test",
    },
    {
        iconPath: mdiPlay,
        name: "RC mode",
        description: "test",
    },
    {
        iconPath: mdiDelete,
        name: "Clear Mission",
        description: "test",
    },
    //here
    {
        iconPath: mdiController,
        name: "RC mode",
        description: "test",
    },
    {
        iconPath: mdiSkipNext,
        name: "test",
        description: "test",
    },
    {
        iconPath: mdiDownload,
        name: "test",
        description: "test",
    },
];

interface Props {
    onClose?: () => void;
}

/**
 * A window showing help information for the Jaia Command & Control user
 *
 * @export
 * @class HelpWindow
 * @typedef {HelpWindow}
 * @extends {React.Component}
 */
export function HelpWindow(props: Props) {
    return (
        <div className="help-window">
            <div className="help-titlebar">
                <div className="help-title">Jaia Command & Control Help</div>
                <Button onClick={props.onClose}>
                    <Icon path={mdiWindowClose} title="Close Window" />
                </Button>
            </div>
            <table className="help-button-table">
                <tbody>
                    {buttons.map((button, index) => (
                        <>
                            {index === 0 && (
                                <tr className="instruction-note-row">
                                    <td colSpan={3} className="instruction-note">
                                        Commands in the commandsDrawer.
                                    </td>
                                </tr>
                            )}
                            {index === 14 && (
                                <tr className="instruction-note-row">
                                    <td colSpan={3} className="instruction-note">
                                        Commands under the Hub.
                                    </td>
                                </tr>
                            )}
                            {index === 17 && (
                                <tr className="instruction-note-row">
                                    <td colSpan={3} className="instruction-note">
                                        Links under the Hub.
                                    </td>
                                </tr>
                            )}
                            {index === 20 && (
                                <tr className="instruction-note-row">
                                    <td colSpan={3} className="instruction-note">
                                        Test.
                                    </td>
                                </tr>
                            )}
                            {getButtonRow(button)}
                        </>
                    ))}
                </tbody>
            </table>
            <div className="help-footer-text">For more help</div>
        </div>
    );
}

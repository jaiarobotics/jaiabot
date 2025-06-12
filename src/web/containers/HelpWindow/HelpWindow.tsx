// Kanz made most recent changes to HelpWindow
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
    mdiWrench,
    mdiSquareEditOutline,
    mdiRuler,
    mdiCancel,
    mdiToggleSwitchOutline,
    mdiAlphaACircleOutline,
    mdiAlphaBCircleOutline,
    mdiAlphaXCircleOutline,
    mdiAlphaYCircleOutline,
    mdiToggleSwitchOffOutline,
    mdiGamepadRight,
    mdiGamepad,
    mdiArrowLeftRightBoldOutline,
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
    {
        iconPath: mdiCheckboxMarkedCirclePlusOutline,
        name: "System Check All Bots",
        description:
            "Run a system check on all bots in the pod.  Missions can only be run after the system check completes successfully.",
    },
    {
        imgSrc: rallyIcon,
        name: "Add Rally Point",
        description: "Add a rally point that can be used at the start or end of a survey mission.",
    },
    {
        iconPath: mdiStop,
        iconStyle: { backgroundColor: "#CC0505" },
        name: "Stop All Missions",
        description: "Order all bots to stop their currently running missions.",
    },
    {
        iconPath: mdiPlay,
        name: "Run Mission",
        description: "Run the mission as currently edited on the map.",
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
            "Open the Mission Panel, which shows each run in the current mission, and which bots are assigned to which run.  Missions can also be saved, loaded, and cleared from this panel.",
    },
    {
        iconPath: mdiSquareEditOutline,
        name: "Edit Optimized Mission Survey",
        description:
            "Open the Optimized Mission Survey, which can be used to configure a survey mission, where the pod of Jaiabots will coordinate to survey an area of the map.  The tasks performed at each waypoint in the survey mission can be customized.",
    },
    {
        iconPath: mdiDownloadMultiple,
        name: "Download All",
        description: "Start downloading log and sensor data from all of the bots to the hub.",
    },
    {
        iconPath: mdiProgressDownload,
        name: "Download Queue",
        description:
            "Open the Download Queue panel, which shows the currently queued data downloads from the bots to the hub.",
    },
    {
        iconPath: mdiCog,
        name: "Settings",
        description: "Open the Settings panel for Jaia Command & Control.",
    },
    {
        iconPath: mdiRuler,
        name: "Measure Distance",
        description:
            "Click two or more points to measure the total distance along a set of line segments.",
    },
    {
        iconPath: mdiAlphaACircleOutline,
        name: "Enable Overdrive",
        description: "To enable the Overdrive function, press A on the controller.",
    },
    {
        iconPath: mdiCancel,
        name: "Cancel Overdrive",
        description: "To cancel Overdrive when given the option, press LB on the controller.",
    },
    {
        iconPath: mdiToggleSwitchOutline,
        name: "Confrim and Activate Overdrive",
        description: "To enable Overdrive when given the option, press RB on the controller.",
    },
    {
        iconPath: mdiToggleSwitchOffOutline,
        name: "Disable Overdrive",
        description: "To disable Overdrive after use, press the A button on the controller.",
    },
    {
        iconPath: mdiAlphaBCircleOutline,
        name: "Activate Dive on Controller ",
        description: "To enable the Dive function, press B on the controller.",
    },
    {
        iconPath: mdiGamepad,
        name: "Travesing through the Dive Options",
        description:
            "To traverse through the Dive options, use the up & down buttons on the D-Pad.",
    },
    {
        iconPath: mdiGamepadRight,
        name: "Play Button on Dive Function",
        description:
            "To press the play button on Dive, hit the right on the D-Pad, and press B on the controller to begin the dive. To deselect, press left on the D-Pad.",
    },
    {
        iconPath: mdiArrowLeftRightBoldOutline,
        name: "To Increase/Decrease the Meters or Seconds for Dive Options",
        description:
            "To increase the options on the controller, press RT on the controller. To decrease the options on the controller, press LT on the controller.",
    },
    {
        iconPath: mdiAlphaXCircleOutline,
        name: "Activate Manual Dual on Controller",
        description: "To enable the Manual Dual function, press X on the controller.",
    },
    {
        iconPath: mdiAlphaYCircleOutline,
        name: "Activate Manual Single on Controller",
        description: "To enable the Manual Single function, press Y on the controller.",
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
                    <Icon path={mdiWindowClose} title="Close Window"></Icon>
                </Button>
            </div>
            <table className="help-button-table">
                <tbody>{buttons.map(getButtonRow)}</tbody>
            </table>
        </div>
    );
}

import Icon from "@mdi/react";
import {
    mdiPlay,
    mdiCheckboxMarkedCirclePlusOutline,
    mdiArrowULeftTop,
    mdiStop,
    mdiViewList,
    mdiDownloadMultiple,
    mdiProgressDownload,
    mdiCog,
    mdiSquareEditOutline,
    mdiRuler,
} from "@mdi/js";
import { Button } from "@mui/material";
import rallyPoint from "../../style/icons/rally-point.svg";
import "./HelpWindow.less";

export default function HelpWindow() {
    return (
        <div className="help-window">
            <h1>Jaia Command & Control Help</h1>
            <div className="help-window-grid">
                {/* Activate */}
                <Button className="jaia-button">
                    <Icon path={mdiCheckboxMarkedCirclePlusOutline} />
                </Button>
                <div className="button-name">Activate</div>
                <div>
                    Performs a system check on the Bots. This check must be completed prior to
                    sending the first mission.
                </div>

                {/* Rally Point */}
                <Button className="jaia-button">
                    <img src={rallyPoint} />
                </Button>
                <div className="button-name">Add Rally Point</div>
                <div>A point for all Bots to converge.</div>

                {/* Stop Bot */}
                <Button className="jaia-button">
                    <Icon path={mdiStop} />
                </Button>
                <div className="button-name">Stop Bot</div>
                <div>Stops a Bot at any point in a mission.</div>

                {/* Start Mission */}
                <Button className="jaia-button">
                    <Icon path={mdiPlay} />
                </Button>
                <div className="button-name">Start Mission</div>
                <div>Sends the Bot on its assigned mission.</div>

                {/* Undo */}
                <Button className="jaia-button">
                    <Icon path={mdiArrowULeftTop} />
                </Button>
                <div className="button-name">Undo</div>
                <div>Reverts the previous mission planning action.</div>

                {/* Missions Panel */}
                <Button className="jaia-button">
                    <Icon path={mdiViewList} />
                </Button>
                <div className="button-name">Missions Panel</div>
                <div>
                    Displays each mission and its Bot assignment. Missions can be saved, loaded, and
                    remvoved from this panel.
                </div>

                {/* Survey Tool */}
                <Button className="jaia-button">
                    <Icon path={mdiSquareEditOutline} />
                </Button>
                <div className="button-name">Survey Tool</div>
                <div>Customize a lawnmower style survey for the Bots.</div>

                {/* Data Offload */}
                <Button className="jaia-button">
                    <Icon path={mdiDownloadMultiple} />
                </Button>
                <div className="button-name">Data Offload</div>
                <div>Moves log data from the Bot to the Hub.</div>

                {/* Data Offload Queue */}
                <Button className="jaia-button">
                    <Icon path={mdiProgressDownload} />
                </Button>
                <div className="button-name">Data Offload Queue</div>
                <div>Shows the progress of the data offload.</div>

                {/* Settings */}
                <Button className="jaia-button">
                    <Icon path={mdiCog} />
                </Button>
                <div className="button-name">Settings</div>
                <div>Contains configurations to modify the map.</div>

                {/* Measure Tool */}
                <Button className="jaia-button">
                    <Icon path={mdiRuler} />
                </Button>
                <div className="button-name">Measure Tool</div>
                <div>
                    Click two or more points to measure the total distance along a set of line
                    segments.
                </div>
            </div>
        </div>
    );
}

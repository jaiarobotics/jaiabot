import React from "react";
import Icon from "@mdi/react";
import Button from "@mui/material/Button";
import OlFeature from "ol/Feature";
import { Point } from "ol/geom";
import { mdiClose } from "@mdi/js";
import { PanelType } from "../CommandControl/CommandControl";
import { mdiPlay, mdiDelete } from "@mdi/js";
import "./RallyPointPanel.less";

export interface Props {
    selectedRallyFeature: OlFeature<Point>;
    goToRallyPoint: (feature: OlFeature<Point>) => void;
    deleteRallyPoint: (feature: OlFeature<Point>) => void;
    setVisiblePanel: (panelType: PanelType) => void;
}

export function RallyPointPanel(props: Props) {
    return (
        <div className="rally-base-grid">
            <div className="rally-layout-container">
                <div
                    className="rally-close-btn"
                    onClick={() => {
                        props.setVisiblePanel(PanelType.NONE);
                    }}
                >
                    <Icon path={mdiClose} size={1} />
                </div>
                <div className="rally-outer-container">
                    <div className="rally-container">
                        <div className="rally-title">
                            Rally: {props.selectedRallyFeature.get("num")}
                        </div>
                        <Button
                            aria-label="Go To Rally Point Label"
                            // testid to be used as last resort
                            data-testid="go-to-rally-point-id"
                            title="Go To Rally Point Button"
                            className={"button-jcc"}
                            onClick={() => props.goToRallyPoint(props.selectedRallyFeature)}
                        >
                            <Icon path={mdiPlay} title="Go To Rally Point" />
                        </Button>
                        <Button
                            aria-label="Delete Rally Point Label"
                            // testid to be used as last resort
                            data-testid="delete-rally-point-id"
                            title="Delete Rally Point Button"
                            className={"button-jcc"}
                            onClick={() => props.deleteRallyPoint(props.selectedRallyFeature)}
                        >
                            <Icon path={mdiDelete} title="Clear Mission" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

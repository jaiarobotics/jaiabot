import { useContext } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import { MIN_SPEED, MAX_SPEED } from "../../../utils/constants";

import Slider from "@mui/material/Slider";
import { amber } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import "./MissionSpeedSliders.less";

enum SpeedTypes {
    NONE = 1,
    TRANSIT = 2,
    STATION_KEEP = 3,
}

const theme = createTheme({ palette: { primary: amber } });

/**
 * Allows operators to set the speeds of a mission set
 */
export default function MissionSpeedSliders() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches action to update the mission speeds
     *
     * @param {SpeedTypes} speedType Speed modified
     * @param {number} speed Speed value chosen
     * @returns {void}
     */
    const handleSpeedChange = (speedType: SpeedTypes, speed: number) => {
        const updatedSpeeds = { ...jaiaContext.missionSpeeds };

        switch (speedType) {
            case SpeedTypes.TRANSIT:
                updatedSpeeds.transit = speed;
                break;
            case SpeedTypes.STATION_KEEP:
                updatedSpeeds.stationkeep_outer = speed;
                break;
        }

        jaiaDispatch({ type: JaiaActions.CHANGE_MISSION_SPEEDS, missionSpeeds: updatedSpeeds });
    };

    if (jaiaContext === null) {
        return;
    }

    return (
        <ThemeProvider theme={theme}>
            <div className="mission-speeds">
                <div>Transit</div>
                <Slider
                    aria-label="Transit Speed"
                    value={jaiaContext.missionSpeeds.transit}
                    step={0.5}
                    marks
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    onChange={(evt: any) =>
                        handleSpeedChange(SpeedTypes.TRANSIT, Number(evt.target.value))
                    }
                />
                <div>{jaiaContext.missionSpeeds.transit}</div>

                <div>Station Keep</div>
                <Slider
                    aria-label="Station Keep Speed"
                    value={jaiaContext.missionSpeeds.stationkeep_outer}
                    step={0.5}
                    marks
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    onChange={(evt: any) =>
                        handleSpeedChange(SpeedTypes.STATION_KEEP, Number(evt.target.value))
                    }
                />
                <div>{jaiaContext.missionSpeeds.stationkeep_outer}</div>
            </div>
        </ThemeProvider>
    );
}

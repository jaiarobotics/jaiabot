import { useContext, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { MIN_SPEED, MAX_SPEED } from "../../utils/constants";

import Slider from "@mui/material/Slider";
import { amber } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import "./MissionSpeedSliders.less";

enum SpeedTypes {
    NONE = 1,
    TRANSIT = 2,
    STATION_KEEP = 3,
}

export default function MissionSpeedSliders() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const [theme, setTheme] = useState(
        createTheme({
            palette: {
                primary: amber,
            },
        }),
    );

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

    return (
        <section className="mission-speeds">
            <div>Transit</div>
            <ThemeProvider theme={theme}>
                <Slider
                    aria-label="Transit"
                    value={jaiaContext.missionSpeeds.transit}
                    step={0.5}
                    marks
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    onChange={(evt: any) =>
                        handleSpeedChange(SpeedTypes.TRANSIT, Number(evt.target.value))
                    }
                />
            </ThemeProvider>
            <div>{jaiaContext.missionSpeeds.transit}</div>

            <div>Station Keep</div>
            <ThemeProvider theme={theme}>
                <Slider
                    aria-label="Station Keep"
                    value={jaiaContext.missionSpeeds.stationkeep_outer}
                    step={0.5}
                    marks
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    onChange={(evt: any) =>
                        handleSpeedChange(SpeedTypes.STATION_KEEP, Number(evt.target.value))
                    }
                />
            </ThemeProvider>
            <div>{jaiaContext.missionSpeeds.stationkeep_outer}</div>
        </section>
    );
}

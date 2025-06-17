import { useContext } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { Button } from "@mui/material";
import { MapModes } from "../../types/openlayers-types";

import rallyIcon from "../../style/icons/rally-point.svg";

/**
 * Produces the button that allows an operator to click on the map and
 * add a rally point
 */
export default function RallyButton() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Provides the base Jaia button class name and toggles the selected name
     * to update the button color
     *
     * @returns {string} Class name that applies the correct style
     */
    const getClassName = () => {
        return `jaia-button ${jaiaContext.mapMode === MapModes.RALLY ? "selected" : ""}`;
    };

    /**
     * Dispatches the action to toggle rally mode on the map
     *
     * @returns {void}
     */
    const handleRallyButtonClick = () => {
        jaiaDispatch({ type: JaiaActions.CLICKED_MAP_MODE_BUTTON, mapMode: MapModes.RALLY });
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"add-rally-point"}
                onClick={() => handleRallyButtonClick()}
            >
                <img src={rallyIcon} />
            </Button>
        </div>
    );
}

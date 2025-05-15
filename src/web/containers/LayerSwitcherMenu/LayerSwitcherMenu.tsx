import { useContext, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { layers } from "../../openlayers/layers/layers";
import { LayerTitles } from "../../types/openlayers-types";
import { MapLayerGroupNames } from "../../types/context-types";

import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Checkbox from "@mui/material/Checkbox";
import { Radio, ThemeProvider, createTheme } from "@mui/material";
import { grey } from "@mui/material/colors";

import "./LayerSwitcherMenu.less";

const BASE_MAPS = [LayerTitles.OSM_LAYER, LayerTitles.ARC_GIS_SATELLITE_LAYER];

/**
 * Creates the accordions for toggling the visibility of map layers
 */
export default function LayerSwitcherMenu() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Creates a map of layer names to their current visibility.
     * Used to initialize the State of the LayerSwitcherMenu component.
     *
     * @returns {Map<LayerTitles, boolean>} A map of layer names to visibility
     */
    const getDefaultLayerCheckedStates = () => {
        const defaultLayerCheckedStates = new Map<LayerTitles, boolean>();

        for (const [layerTitle, layer] of layers.getLayers().entries()) {
            if (layer.isVisible()) {
                defaultLayerCheckedStates.set(layerTitle, true);
            } else {
                defaultLayerCheckedStates.set(layerTitle, false);
            }
        }

        return defaultLayerCheckedStates;
    };

    /**
     * Retrieves the visible base map layer to use as the default when the LayerSwitcherMenu mounts
     *
     * @returns {LayerTitles} Name of visible base map layer
     */
    const getDefaultBaseMapLayerCheckedState = () => {
        for (const baseMapTitle of BASE_MAPS) {
            if (layers.getLayer(baseMapTitle).isVisible()) {
                return baseMapTitle;
            }
        }
    };

    const [layerCheckedStates, setLayerCheckedStates] = useState(getDefaultLayerCheckedStates());
    const [checkedBaseMap, setCheckedBaseMap] = useState(getDefaultBaseMapLayerCheckedState());
    const [accordionTheme, setAccordionTheme] = useState(
        createTheme({
            transitions: {
                create: () => "none",
            },
        }),
    );

    /**
     * Notifies Context which accordion the operator clicked on. This data lives in Context
     * to preserve the accordion states through mounts/unmounts of the LayerSwitcherMenu.
     *
     * @param {MapLayerGroupNames} accordionName Name of the accordion selected
     * @returns {void}
     */
    const handleAccordionClick = (accordionName: MapLayerGroupNames) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_MAP_LAYERS_ACCORDION,
            mapLayerGroupName: accordionName,
        });
    };

    /**
     * Updates the visibility property on the layer + updates the checked property managed by State.
     * We need to utilize both for the best user experience. If not, there will be a lag in the
     * checkbox when clicking on a layer.
     *
     * @param {LayerTitles} layerTitle Name of the layer selected
     * @returns {void}
     */
    const handleLayerClick = (layerTitle: LayerTitles) => {
        const layer = layers.getLayer(layerTitle);
        const updatedIsVisible = !layer.isVisible();
        layer.setVisible(updatedIsVisible);

        const updatedLayerCheckedStates = new Map(layerCheckedStates);
        updatedLayerCheckedStates.set(layerTitle, updatedIsVisible);
        setLayerCheckedStates(updatedLayerCheckedStates);
    };

    /**
     * Only one base map can be selected at a time so we need to manage its checked
     * state separately
     *
     * @param {LayerTitles} layerTitle Name of the base map selected
     * @returns {void}
     */
    const handleBaseMapClick = (layerTitle: LayerTitles) => {
        if (checkedBaseMap !== layerTitle) {
            // Make the previous selection not visible
            const currentLayer = layers.getLayer(checkedBaseMap);
            currentLayer.setVisible(false);
            // Make the latest selection visible
            const newLayer = layers.getLayer(layerTitle);
            newLayer.setVisible(true);
        }

        setCheckedBaseMap(layerTitle);
    };

    /**
     * Changes the default style of the checkbox
     *
     * @returns {MUI Style Object} Updated style for the checkbox
     */
    const getCheckboxStyle = () => {
        return {
            "&.Mui-checked": { color: grey[800] },
        };
    };

    if (jaiaContext === null) {
        return <div></div>;
    }

    return (
        <div className="layer-switcher-menu accordions-container">
            <ThemeProvider theme={accordionTheme}>
                <Accordion
                    className="accordion-container"
                    expanded={jaiaContext.mapLayerGroupStates.baseMaps}
                    onChange={() => handleAccordionClick(MapLayerGroupNames.BASE_MAPS)}
                >
                    <AccordionSummary className="accordion-summary" expandIcon={<ExpandMoreIcon />}>
                        <Typography>Base Maps</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="layer-group">
                        <div className="layer-container">
                            <Radio
                                onClick={() => handleBaseMapClick(LayerTitles.OSM_LAYER)}
                                checked={LayerTitles.OSM_LAYER === checkedBaseMap}
                                sx={getCheckboxStyle()}
                            />
                            <p>Open Street Maps</p>
                        </div>
                        <div className="layer-container">
                            <Radio
                                onClick={() =>
                                    handleBaseMapClick(LayerTitles.ARC_GIS_SATELLITE_LAYER)
                                }
                                checked={LayerTitles.ARC_GIS_SATELLITE_LAYER === checkedBaseMap}
                                sx={getCheckboxStyle()}
                            />
                            <p>ArcGIS Satellite Imagery</p>
                        </div>
                    </AccordionDetails>
                </Accordion>
            </ThemeProvider>

            <ThemeProvider theme={accordionTheme}>
                <Accordion
                    className="accordion-container"
                    expanded={jaiaContext.mapLayerGroupStates.mission}
                    onChange={() => handleAccordionClick(MapLayerGroupNames.MISSION)}
                >
                    <AccordionSummary className="accordion-summary" expandIcon={<ExpandMoreIcon />}>
                        <Typography>Mission</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="layer-group">
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.BOT_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.BOT_LAYER)}
                                sx={getCheckboxStyle()}
                            />
                            <p>Bots</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.HUB_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.HUB_LAYER)}
                                sx={getCheckboxStyle()}
                            />
                            <p>Hubs</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.MISSION_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.MISSION_LAYER)}
                                sx={getCheckboxStyle()}
                            />
                            <p>Missions</p>
                        </div>
                    </AccordionDetails>
                </Accordion>
            </ThemeProvider>
        </div>
    );
}

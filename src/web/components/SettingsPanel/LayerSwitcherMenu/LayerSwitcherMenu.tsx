import { useContext, useState } from "react";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { layers } from "../../../openlayers/layers/layers";
import { offlineLayerManager } from "../../../openlayers/layers/offline/offline-layer-manager";
import { LayerTitles } from "../../../types/openlayers-types";
import { MapLayerAccordionNames } from "../../../types/context-types";
import { accordionTheme } from "../../../utils/style";

import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Checkbox from "@mui/material/Checkbox";
import { Radio, ThemeProvider } from "@mui/material";
import { grey } from "@mui/material/colors";

import "./LayerSwitcherMenu.less";

interface Props {
    style: { [key: string]: {} };
}

const BASE_MAPS = [
    LayerTitles.OSM_LAYER,
    LayerTitles.ARC_GIS_SATELLITE_LAYER,
    LayerTitles.NOAA_ENC_LAYER,
];

/**
 * Creates the accordions for toggling the visibility of map layers
 */
export default function LayerSwitcherMenu() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Creates a map of layer titles to their current visibility.
     * Used to initialize the State of the LayerSwitcherMenu component.
     *
     * @returns {Map<LayerTitles, boolean>} A map of layer titles to visibility
     */
    const getDefaultLayerCheckedStates = () => {
        const defaultLayerCheckedStates = new Map<LayerTitles, boolean>();

        for (const [layerTitle, layer] of layers.getLayers()) {
            defaultLayerCheckedStates.set(layerTitle, layer.getVisible());
        }

        return defaultLayerCheckedStates;
    };

    /**
     * Retrieves the visible base map layer to use as the default when the LayerSwitcherMenu mounts
     *
     * @returns {LayerTitles} Title of visible base map layer
     */
    const getDefaultBaseMapLayerCheckedState = () => {
        for (const baseMapTitle of BASE_MAPS) {
            if (layers.getLayer(baseMapTitle).getVisible()) {
                return baseMapTitle;
            }
        }
    };

    const [layerCheckedStates, setLayerCheckedStates] = useState(getDefaultLayerCheckedStates());
    const [checkedBaseMap, setCheckedBaseMap] = useState(getDefaultBaseMapLayerCheckedState());

    /**
     * Notifies Context which accordion the operator clicked on. This data lives in Context
     * to preserve the accordion states through mounts/unmounts of the LayerSwitcherMenu.
     *
     * @param {MapLayerAccordionNames} accordionName Name of the accordion selected
     * @returns {void}
     */
    const handleAccordionClick = (accordionName: MapLayerAccordionNames) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_MAP_LAYERS_ACCORDION,
            mapLayerAccordionName: accordionName,
        });
    };

    /**
     * Updates the visibility property on the layer + updates the checked property managed by State.
     * We need to utilize both for the best user experience. If not, there will be a lag in the
     * checkbox when clicking on a layer.
     *
     * @param {LayerTitles} layerTitle Title of the layer selected
     * @returns {void}
     */
    const handleLayerClick = (layerTitle: LayerTitles) => {
        const layer = layers.getLayer(layerTitle);
        const updatedVisible = !layer.getVisible();
        layer.setVisible(updatedVisible);

        const updatedLayerCheckedStates = new Map(layerCheckedStates);
        updatedLayerCheckedStates.set(layerTitle, updatedVisible);
        setLayerCheckedStates(updatedLayerCheckedStates);
    };

    /**
     * Only one base map can be selected at a time so we need to manage its checked
     * state separately
     *
     * @param {LayerTitles} layerTitle Title of the base map selected
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
        return;
    }

    return (
        <div className="layer-switcher-menu accordions-container">
            <ThemeProvider theme={accordionTheme}>
                <Accordion
                    className="accordion-container"
                    expanded={jaiaContext.mapLayerAccordionStates.baseMaps}
                    onChange={() => handleAccordionClick(MapLayerAccordionNames.BASE_MAPS)}
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
                                data-testid={`${LayerTitles.OSM_LAYER}-radio`}
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
                                data-testid={`${LayerTitles.ARC_GIS_SATELLITE_LAYER}-radio`}
                            />
                            <p>ArcGIS Satellite Imagery</p>
                        </div>
                        <div className="layer-container">
                            <Radio
                                onClick={() => handleBaseMapClick(LayerTitles.NOAA_ENC_LAYER)}
                                checked={LayerTitles.NOAA_ENC_LAYER === checkedBaseMap}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.NOAA_ENC_LAYER}-radio`}
                            />
                            <p>NOAA Navigational Charts</p>
                        </div>
                    </AccordionDetails>
                </Accordion>

                <Accordion
                    className="accordion-container"
                    expanded={jaiaContext.mapLayerAccordionStates.mission}
                    onChange={() => handleAccordionClick(MapLayerAccordionNames.MISSION)}
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
                                data-testid={`${LayerTitles.BOT_LAYER}-checkbox`}
                            />
                            <p>Bots</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.HUB_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.HUB_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.HUB_LAYER}-checkbox`}
                            />
                            <p>Hubs</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.MISSION_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.MISSION_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.MISSION_LAYER}-checkbox`}
                            />
                            <p>Missions</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.GHOST_MISSION_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.GHOST_MISSION_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.GHOST_MISSION_LAYER}-checkbox`}
                            />
                            <p>Ghost Missions</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.RALLY_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.RALLY_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.RALLY_LAYER}-checkbox`}
                            />
                            <p>Rally Points</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.HUB_COMMS_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.HUB_COMMS_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.HUB_COMMS_LAYER}-checkbox`}
                            />
                            <p>Hub Range</p>
                        </div>
                    </AccordionDetails>
                </Accordion>

                <Accordion
                    className="accordion-container"
                    expanded={jaiaContext.mapLayerAccordionStates.measurements}
                    onChange={() => handleAccordionClick(MapLayerAccordionNames.MEASUREMENTS)}
                >
                    <AccordionSummary className="accordion-summary" expandIcon={<ExpandMoreIcon />}>
                        <Typography>Measurements</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="layer-group">
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.DIVE_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.DIVE_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.DIVE_LAYER}-checkbox`}
                            />
                            <p>Dive Packets</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.DRIFT_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.DRIFT_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.DRIFT_LAYER}-checkbox`}
                            />
                            <p>Drift Packets</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() => handleLayerClick(LayerTitles.CONTOUR_LAYER)}
                                checked={layerCheckedStates.get(LayerTitles.CONTOUR_LAYER)}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.CONTOUR_LAYER}-checkbox`}
                            />
                            <p>Depth Contours</p>
                        </div>
                        <div className="layer-container">
                            <Checkbox
                                onClick={() =>
                                    handleLayerClick(LayerTitles.EXCLUDED_TASK_PACKETS_LAYER)
                                }
                                checked={layerCheckedStates.get(
                                    LayerTitles.EXCLUDED_TASK_PACKETS_LAYER,
                                )}
                                sx={getCheckboxStyle()}
                                data-testid={`${LayerTitles.EXCLUDED_TASK_PACKETS_LAYER}-checkbox`}
                            />
                            <p>Excluded Task Packets</p>
                        </div>
                    </AccordionDetails>
                </Accordion>

                <Accordion
                    className="accordion-container"
                    expanded={jaiaContext.mapLayerAccordionStates.offline}
                    onChange={() => handleAccordionClick(MapLayerAccordionNames.OFFLINE)}
                >
                    <AccordionSummary className="accordion-summary" expandIcon={<ExpandMoreIcon />}>
                        <Typography>Offline</Typography>
                    </AccordionSummary>
                    <OfflineLayersAccordionDetails style={getCheckboxStyle()} />
                </Accordion>
            </ThemeProvider>
        </div>
    );
}

/**
 * Renders the list of offline layers that the operator can toggle on/off
 */
function OfflineLayersAccordionDetails(props: Props) {
    /**
     * Creats a map of layer titles to their visibility
     *
     * @returns {Map<string, boolean>} Map of layer titles to visibility
     */
    const refreshCheckedStates = () => {
        const checkedStates = new Map<string, boolean>();
        for (const layer of offlineLayerManager.getLayers().getArray()) {
            checkedStates.set(layer.get("title"), layer.getVisible());
        }
        return checkedStates;
    };

    const [checkedStates, setCheckedStates] = useState(refreshCheckedStates());

    /**
     * Toggles the layer visibility
     *
     * @param {string} title Identifies the layer
     * @returns {void}
     */
    const handleLayerClick = (title: string) => {
        for (const layer of offlineLayerManager.getLayers().getArray()) {
            if (layer.get("title") === title) {
                const updatedVisible = !layer.getVisible();
                layer.setVisible(updatedVisible);
                setCheckedStates(refreshCheckedStates());
            }
        }
    };

    return (
        <AccordionDetails className="layer-group">
            {offlineLayerManager
                .getLayers()
                .getArray()
                .map((layer) => {
                    const title = layer.get("title");
                    return (
                        <div className="layer-container" key={title}>
                            <Checkbox
                                onClick={() => handleLayerClick(title)}
                                checked={checkedStates.get(title) ?? false}
                                sx={props.style}
                                data-testid={`${title}-checkbox`}
                            />
                            <p>{title}</p>
                        </div>
                    );
                })}
        </AccordionDetails>
    );
}

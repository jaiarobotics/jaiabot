import { useState } from "react";
import Icon from "@mdi/react";
import { mdiArrowRight } from "@mdi/js";
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import TileLayer from "ol/layer/Tile";
import { TileImage } from "ol/source";
import { view } from "../../../openlayers/views/view";
import { layers } from "../../../openlayers/layers/layers";
import { offlineMapDownloader } from "../../../openlayers/layers/offline/offline-layer-downloader";
import { LayerTitles } from "../../../types/openlayers-types";
import "./OfflineMaps.less";

const ONLINE_TILE_LAYERS: LayerTitles[] = [
    LayerTitles.OSM_LAYER,
    LayerTitles.ARC_GIS_SATELLITE_LAYER,
    LayerTitles.NOAA_ENC_LAYER,
];
// We estimate about 11 kB per tile, which is approximately correct for larger tile file sizes (such as satellite imagery).
// Other layers may be significantly less, such as Open Street Maps or NOAA ENC tiles.
const ESTIMATED_TILE_SIZE = 11_000;

export default function OfflineMaps() {
    const [selectedOnlineLayerName, setSelectedOnlineLayerName] = useState(null);

    const getOnlineTileLayerMenuItems = () => {
        return ONLINE_TILE_LAYERS.map((layerTitle) => (
            <MenuItem value={layerTitle} key={layerTitle}>
                {layerTitle}
            </MenuItem>
        ));
    };

    const importOnlineTileLayer = () => {
        const layer = layers.getLayer(selectedOnlineLayerName) as TileLayer<TileImage>;
        const tileCount = offlineMapDownloader.getTileCount(view, layer);
        const esimatedSize = tileCount * ESTIMATED_TILE_SIZE;
        // Need alert
        offlineMapDownloader.add(view, layer);
    };

    return (
        <div className="offline-maps-container">
            <div className="geotiff-container"></div>
            <div className="save-tiles-container">
                <div className="heading">Save Map to Hub</div>
                <div className="layer-selection-container">
                    <div className="select-section">
                        <FormControl style={{ width: "200px" }}>
                            <InputLabel>Layer</InputLabel>
                            <Select
                                value={selectedOnlineLayerName}
                                onChange={(evt: SelectChangeEvent) =>
                                    setSelectedOnlineLayerName(evt.target.value)
                                }
                                label="Layer"
                            >
                                {getOnlineTileLayerMenuItems()}
                            </Select>
                        </FormControl>
                        <div onClick={() => importOnlineTileLayer()}>
                            <Icon path={mdiArrowRight} />
                        </div>
                    </div>
                    <TileDownloadStatus />
                </div>
            </div>
            <div className="offline-layers-container"></div>
        </div>
    );
}

function TileDownloadStatus() {
    const tile = offlineMapDownloader.getTileDescriptors().at(0);
    if (!tile) {
        return null;
    }

    if (!offlineMapDownloader.getIsRunning()) {
        return null;
    }

    const remainingTileCount = offlineMapDownloader.getTileDescriptors().length;
    const totalTileCount = offlineMapDownloader.getCompletedTiles() + remainingTileCount;
    const percent = Math.round((100 * offlineMapDownloader.getCompletedTiles()) / totalTileCount);

    return (
        <div className="progress-section">
            <div>
                <p>{`Importing ${tile.layerName}`}</p>
                <p>{`${offlineMapDownloader.getCompletedTiles()} / ${totalTileCount} (${percent}%)`}</p>
            </div>
            <button onClick={() => offlineMapDownloader.clear()}>Cancel</button>
        </div>
    );
}

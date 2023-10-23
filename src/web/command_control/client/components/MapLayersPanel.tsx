import React from 'react'
import '../style/components/MapLayersPanel.css'

export default function MapLayers() {
    return (
        <div className="map-layers-outer-container">
            <div className="panel-heading">Map Layers</div> 
            <div className="map-layers-inner-container" id="mapLayers"></div>
        </div>
    )
}

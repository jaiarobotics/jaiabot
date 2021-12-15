/* eslint-disable no-unused-vars */

import React from 'react';

import OlMap from 'ol/Map';
import OlView from 'ol/View';
import OlLayerGroup from 'ol/layer/Group';
import OlSourceTileJson from 'ol/source/TileJSON';
import OlSourceOsm from 'ol/source/OSM';
import OlFormatGeoJson from 'ol/format/GeoJSON';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import OlPoint from 'ol/geom/Point';
import OlFeature from 'ol/Feature';
import OlTileLayer from 'ol/layer/Tile';
import OlTileWMS from 'ol/source/TileWMS';
import { fromLonLat, getTransform } from 'ol/proj';
import OlStyle from 'ol/style/Style';
import OlText from 'ol/style/Text';
import OlFill from 'ol/style/Fill';
import OlStroke from 'ol/style/Stroke';
import OlPolygon from 'ol/geom/Polygon';
import { click, pointerMove, altKeyOnly } from 'ol/events/condition';
import OlSelect from 'ol/interaction/Select';

const PropTypes = require('prop-types');

export default class AssetInfo extends React.Component {
  constructor(props) {
    super(props);
    if (Array.isArray(props.asset)) {
      // I don't even know how to destructure this
      // eslint-disable-next-line prefer-destructuring
      this.asset = props.asset[0];
    } else {
      this.asset = props.asset;
    }
    this.map = props.map;
  }

  componentDidMount() {}

  componentWillUnmount() {}

  render() {
    return (
      <div className="panel">
        <h2>{this.asset.getId()}</h2>
      </div>
    );
  }
}

AssetInfo.propTypes = {
  map: PropTypes.instanceOf(OlMap).isRequired,
  asset: PropTypes.instanceOf(OlFeature).isRequired
};

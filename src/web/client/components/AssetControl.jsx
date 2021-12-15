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

import $ from 'jquery';
import 'jquery-ui/themes/base/core.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/widgets/slider';
import 'jquery-ui/themes/base/slider.css';

import JaiaAPI from '../../common/JaiaAPI';

import AxForm from './AxForm';

const PropTypes = require('prop-types');

export default class AssetControl extends React.Component {
  constructor(props) {
    super(props);
    if (Array.isArray(props.asset)) {
      // I don't even know how to destructure this
      // eslint-disable-next-line prefer-destructuring
      this.asset = props.asset[0];
    } else {
      this.asset = props.asset;
    }
    this.state = {
      desiredHeading: 0,
      desiredThrottle: 0
    };
  }

  componentDidMount() {
    const us = this;
    $('#throttleSlider').slider({
      max: 100,
      min: 0,
      orientation: 'horizontal',
      value: this.asset.get('speed'),
      slide(event, ui) {
        us.sendThrottle(ui.value);
      }
    });
  }

  componentWillUnmount() {}

  sendStop() {
    this.sendThrottle(0);
  }

  sendManualControl(heading, throttle) {
    const { sna } = this.props;
    return sna.sendManualControl(heading, throttle, 0);
  }

  sendHeading(newHeading) {
    // Constrain to 0-360
    let heading = newHeading;
    while (heading < 0) heading += 360;
    while (heading > 360) heading -= 360;
    const { desiredThrottle } = this.state;
    this.setState({ desiredHeading: heading });
    this.sendManualControl(heading, desiredThrottle);
  }

  sendThrottle(throttle) {
    const { desiredHeading } = this.state;
    this.setState({ desiredThrottle: throttle });
    this.sendManualControl(desiredHeading, throttle);
  }

  render() {
    const { desiredHeading, desiredThrottle } = this.state;
    const actualHeading = this.asset.get('heading');
    const actualThrottle = this.asset.get('speed');
    $('#throttleSlider').slider('value', desiredThrottle);
    return (
      <div key={this.asset.getId()}>
        <div>
          Bot ID:
          {this.asset.getId()}
        </div>
        <div>
          Actual Heading:
          {actualHeading}
        </div>
        <div>
          Actual Throttle:
          {actualThrottle}
        </div>
        <div>
          Desired Heading:
          {desiredHeading}
        </div>
        <div>
          Desired Throttle:
          {desiredThrottle}
        </div>
        <button style={{"backgroundColor":"red"}} type="button" onClick={this.sendStop.bind(this)}>
          Stop
        </button>
        <br />
        <button type="button" onClick={this.sendHeading.bind(this, desiredHeading - 15)}>
          Port 15 deg
        </button>
        <button type="button" onClick={this.sendHeading.bind(this, desiredHeading + 15)}>
          Starboard 15 deg
        </button>
        <br />
        <button type="button" onClick={this.sendHeading.bind(this, desiredHeading - 45)}>
          Port 45 deg
        </button>
        <button type="button" onClick={this.sendHeading.bind(this, desiredHeading + 45)}>
          Starboard 45 deg
        </button>
        <br />
        <button type="button" onClick={this.sendHeading.bind(this, desiredHeading - 90)}>
          Port 90 deg
        </button>
        <button type="button" onClick={this.sendHeading.bind(this, desiredHeading + 90)}>
          Starboard 90 deg
        </button>
        <br />
        Speed:
        <div id="throttleSlider" />
      </div>
    );
  }
}

AssetControl.propTypes = {
  map: PropTypes.instanceOf(OlMap).isRequired,
  asset: PropTypes.instanceOf(OlFeature).isRequired,
  sna: PropTypes.instanceOf(JaiaAPI).isRequired
};

/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExpand, faPlus, faSync, faTimes, faArrowsAlt
} from '@fortawesome/free-solid-svg-icons';
import {
  faCheckSquare, faSquare, faSave, faEdit
} from '@fortawesome/free-regular-svg-icons';

import OlMap from 'ol/Map';
import OlFormatGeoJson from 'ol/format/GeoJSON';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import { click } from 'ol/events/condition';
import { Draw as OlDraw, Modify as OlModify, Select as OlSelect } from 'ol/interaction';

import JsonAPI from '../../common/JsonAPI';
import shapes from '../libs/shapes';

const { getWaypointStyle } = shapes;

export default class LayerEditControls extends React.Component {
  constructor(props) {
    super(props);

    this.selectPointInteraction = null;
  }

  componentDidMount() {
    const { activeEditLayer } = this.props;
    const { changeInteraction } = this.props;
    this.selectPointInteraction = new OlSelect({
      source: activeEditLayer.getSource()
      // style: style for moveable features
    });
    const { setActiveEditWaypoint } = this.props;
    this.selectPointInteraction.on('select', (event) => {
      if (event.selected.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        const activeEditWaypoint = event.selected[0];
        setActiveEditWaypoint(activeEditWaypoint);
      }
    });
    changeInteraction(this.selectPointInteraction);
  }

  componentWillUnmount() {
    const { changeInteraction, setActiveEditWaypoint } = this.props;
    setActiveEditWaypoint(null);
    changeInteraction();
  }

  addWaypoint() {
    const { activeEditLayer } = this.props;
    const { changeInteraction } = this.props;
    let index = 0;
    let newFeatureName;
    do {
      index += 1;
      newFeatureName = `Waypoint${index}`;
    } while (activeEditLayer.getSource().getFeatureById(newFeatureName) !== null);
    const addPointInteraction = new OlDraw({
      source: activeEditLayer.getSource(),
      type: 'Point',
      maxPoints: 1
    });
    const { setActiveFileDirty, waypointDefaultProperties } = this.props;
    addPointInteraction.on('drawend', (event) => {
      changeInteraction(this.selectPointInteraction);
      event.feature.setId(newFeatureName);
      waypointDefaultProperties.forEach((value, key, map) => {
        event.feature.set(key, value);
      });
      setActiveFileDirty(true);
    });
    changeInteraction(addPointInteraction);
  }

  deleteWaypoint() {
    const { activeEditLayer } = this.props;
    const { changeInteraction } = this.props;
    const deletePointInteraction = new OlSelect({
      source: activeEditLayer.getSource(),
      // style: style for moveable features
      condition: click
    });
    const { setActiveFileDirty } = this.props;
    deletePointInteraction.on('select', (event) => {
      if (event.selected.length > 0) {
        setActiveFileDirty(true);
      }
      event.selected.forEach((feature) => {
        if (feature) {
          activeEditLayer.getSource().removeFeature(feature);
          deletePointInteraction.getFeatures().remove(feature);
        }
      });
      changeInteraction(this.selectPointInteraction);
    });
    changeInteraction(deletePointInteraction, 'pointer');
  }

  moveWaypoint() {
    const { activeEditLayer } = this.props;
    const { changeInteraction } = this.props;
    const movePointInteraction = new OlModify({
      source: activeEditLayer.getSource()
      // style: style for moveable features
    });
    const { setActiveFileDirty } = this.props;
    movePointInteraction.on('modifyend', () => {
      setActiveFileDirty(true);
      changeInteraction(this.selectPointInteraction);
    });
    changeInteraction(movePointInteraction, 'move');
  }

  zoomToFileLayerExtent(fileName) {
    if (!this.isLoaded(fileName)) {
      // Come back after we've loaded the file
      this.loadFile(fileName).then(this.zoomToFileLayerExtent.bind(this, fileName));
      return;
    }
    const { map } = this.props;
    const dataLayer = this.getDataLayerFromFileName(fileName);
    if (dataLayer.getSource().getFeatures().length < 1) {
      return;
    }
    const { mapView } = this.props;
    mapView.fit(dataLayer.getSource().getExtent(), {
      duration: 300
    });
    if (map.getView().getZoom() > 18) {
      map.getView().setZoom(18);
    }
    map.render();
  }

  render() {
    const { activeEditLayer, setActiveFileDirty } = this.props;

    return (
      <div className="waypointEditControls">
        {activeEditLayer ? (
          <div className="toolbar">
            <h2>Edit Points</h2>
            <button type="button" onClick={this.addWaypoint.bind(this)} title="Add Point">
              <FontAwesomeIcon icon={faPlus} />
              {' '}
Add
            </button>
            <button type="button" onClick={this.deleteWaypoint.bind(this)} title="Delete Point">
              <FontAwesomeIcon icon={faTimes} />
              {' '}
Delete
            </button>
            <button type="button" onClick={this.moveWaypoint.bind(this)} title="Move Point">
              <FontAwesomeIcon icon={faArrowsAlt} />
              {' '}
Move
            </button>
          </div>
        ) : (
          ''
        )}
      </div>
    );
  }
}
LayerEditControls.propTypes = {
  activeEditLayer: PropTypes.instanceOf(OlVectorLayer).isRequired,
  map: PropTypes.instanceOf(OlMap).isRequired,
  changeInteraction: PropTypes.func.isRequired,
  setActiveFileDirty: PropTypes.func.isRequired,
  setActiveEditWaypoint: PropTypes.func.isRequired,
  mapView: PropTypes.shape({
    centerOn: PropTypes.func.isRequired,
    fit: PropTypes.func.isRequired
  }).isRequired,
  waypointDefaultProperties: PropTypes.instanceOf(Map)
};

LayerEditControls.defaultProps = {
  waypointDefaultProperties: new Map()
};

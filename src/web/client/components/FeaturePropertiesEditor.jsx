/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import OlMap from 'ol/Map';
import OlFeature from 'ol/Feature';

import shapes from '../libs/shapes';

export default class FeaturePropertiesEditor extends React.Component {
  // constructor(props) {
  //   super(props);
  // }

  handleWaypointNameChange(event) {
    const { activeEditWaypoint } = this.props;
    activeEditWaypoint.setId(event.target.value);
    const { setActiveFileDirty, setActiveEditWaypoint } = this.props;
    setActiveFileDirty(true);
    setActiveEditWaypoint(activeEditWaypoint);
    // this.setState({ activeEditWaypoint });
  }

  handleWaypointPropertyChange(property, event) {
    const { activeEditWaypoint } = this.props;
    activeEditWaypoint.set(property, event.target.value);
    const { setActiveFileDirty, setActiveEditWaypoint } = this.props;
    setActiveFileDirty(true);
    setActiveEditWaypoint(activeEditWaypoint);
    // this.setState({ activeEditWaypoint, activeFileDirty: true });
  }

  render() {
    const { activeEditWaypoint } = this.props;

    return (
      <div>
        {activeEditWaypoint ? (
          <div className="featurePropertiesEditor" key={activeEditWaypoint}>
            <h2>Edit Point Details</h2>
            <table>
              {/*
              <thead>
                <tr>
                  <td>Parameter</td>
                  <td>Value</td>
                </tr>
              </thead>
              */}
              <tbody>
                <tr key={activeEditWaypoint}>
                  <td>Name</td>
                  <td>
                    <input
                      type="text"
                      value={activeEditWaypoint.getId()}
                      onChange={this.handleWaypointNameChange.bind(this)}
                    />
                  </td>
                </tr>
                {activeEditWaypoint.getKeys().map((property) => {
                  if (property === 'geometry') return '';
                  return (
                    <tr key={property}>
                      <td>{property}</td>
                      <td>
                        <input
                          type="text"
                          value={activeEditWaypoint.get(property)}
                          onChange={this.handleWaypointPropertyChange.bind(this, property)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          ''
        )}
      </div>
    );
  }
}
FeaturePropertiesEditor.propTypes = {
  activeEditWaypoint: PropTypes.instanceOf(OlFeature).isRequired,
  // map: PropTypes.instanceOf(OlMap).isRequired,
  setActiveEditWaypoint: PropTypes.func.isRequired,
  setActiveFileDirty: PropTypes.func.isRequired,
  mapView: PropTypes.shape({
    centerOn: PropTypes.func.isRequired,
    fit: PropTypes.func.isRequired
  }).isRequired
};

FeaturePropertiesEditor.defaultProps = {};

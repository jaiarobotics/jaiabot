/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEdit,
  faExpand,
  faFolderOpen,
  faPlus,
  faSave,
  faSync,
  faTimes,
  faArrowsAlt
} from '@fortawesome/free-solid-svg-icons';

import dateFormat from 'dateformat';

import OlMap from 'ol/Map';
import OlFormatGeoJson from 'ol/format/GeoJSON';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import { click } from 'ol/events/condition';
import { Draw as OlDraw, Modify as OlModify, Select as OlSelect } from 'ol/interaction';

import JaiaAPI from '../../common/JaiaAPI';

import AxForm from './AxForm';

const GeographicLib = require('geographiclib');

const geod = GeographicLib.Geodesic.WGS84;

export default class MissionControl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {}

  componentWillUnmount() {}

  render() {
    const { missionExecutionState, startMission, stopMission } = this.props;

    if (!missionExecutionState) {
      return <div>Loading...</div>;
    }

    let missionTime = 0;
    if (missionExecutionState.startTime && missionExecutionState.currentTime) {
      missionTime = missionExecutionState.currentTime - missionExecutionState.startTime;
    }

    return (
      <div className="mission-state">
        {' '}
        {missionExecutionState.error ? (
          <div>
            Mission Error:
            {missionExecutionState.error}
          </div>
        ) : (
          ''
        )}
        <div>
          {missionExecutionState.isActive ? (
            <div>
              <h2>
                {dateFormat(new Date(missionTime), 'HH:MM:ss ', true)}
                {missionExecutionState.planName}
              </h2>
            </div>
          ) : (
            'Inactive'
          )}
        </div>
        <div>
          {missionExecutionState.isActive ? (
            <button type="button" className="missionControlButton" onClick={stopMission}>
              Stop
            </button>
          ) : (
            <button type="button" className="missionControlButton" onClick={startMission}>
              Start
            </button>
          )}
        </div>
      </div>
    );
  }
}

MissionControl.propTypes = {
  missionExecutionState: PropTypes.shape({
    planName: PropTypes.string,
    missionPlan: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        formationType: PropTypes.string,
        OtherCommand: PropTypes.string,
        parameters: PropTypes.arrayOf(PropTypes.number),
        formationParameters: PropTypes.arrayOf(PropTypes.number)
      }).isRequired
    ),
    isActive: PropTypes.bool,
    isExecuting: PropTypes.bool,
    missionSegment: PropTypes.number,
    error: PropTypes.string,
    lastAction: PropTypes.shape({
      type: PropTypes.string,
      formationType: PropTypes.string,
      OtherCommand: PropTypes.string,
      parameters: PropTypes.arrayOf(PropTypes.number),
      formationParameters: PropTypes.arrayOf(PropTypes.number)
    })
  }).isRequired,
  startMission: PropTypes.func.isRequired,
  stopMission: PropTypes.func.isRequired
  // pauseMission: PropTypes.func,
  //  missionExecLayerCollection: PropTypes.instanceOf(OlCollection).isRequired
};

MissionControl.defaultProps = {
  // pauseMission: null
};

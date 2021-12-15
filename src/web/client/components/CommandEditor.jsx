/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEdit,
  faExpand,
  faMapPin,
  faMapMarkerAlt,
  faMapMarkedAlt,
  faCrosshairs,
  faFolderOpen,
  faPlus,
  faSave,
  faSync,
  faTimes,
  faArrowsAlt,
  faEllipsisH
} from '@fortawesome/free-solid-svg-icons';

import OlMap from 'ol/Map';
import OlFormatGeoJson from 'ol/format/GeoJSON';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import { click } from 'ol/events/condition';
import {
  Draw as OlDraw,
  Modify as OlModify,
  Select as OlSelect,
  defaults as OlDefaultInteractions,
  Pointer as OlPointerInteraction,
  Translate as OlTranslate
} from 'ol/interaction';
import cmdIconStop from '../icons/Stop.png';
import cmdIconLineFormation from '../icons/formations/LineFormation3.png';
import cmdIconCircleFormation from '../icons/formations/CircleFormation2.png';

import cmdIconBeep from '../icons/other_commands/beep.png';
// import cmdIconDefault from '../icons/other_commands/default.png';
import cmdIconDive from '../icons/other_commands/dive.png';
import cmdIconDiveBottom from '../icons/other_commands/DiveBottom.png';
import cmdIconDiveDefault from '../icons/other_commands/DiveDefault.png';
import cmdIconDiveDrift from '../icons/other_commands/DiveDrift.png';
import cmdIconDiveProfile from '../icons/other_commands/DiveProfile.png';
import cmdIconJump from '../icons/other_commands/Jump1.png';
import cmdIconLineData from '../icons/other_commands/SurfaceData.png';
import cmdIconOverrideOOW from '../icons/other_commands/OverrideOOW.png';
import cmdIconLED from '../icons/other_commands/LED.png';

import JsonAPI from '../../common/JsonAPI';
import JaiaAPI from '../../common/JaiaAPI';

import AxForm from './AxForm';

import {
  error, success, warning, info, debug
} from '../libs/notifications';

import CommandTypeSelector from './CommandTypeSelector'

const GeographicLib = require('geographiclib');

const geod = GeographicLib.Geodesic.WGS84;

// For transforming clicked coordinates to lat/long from the Mercator coordinate system
import { fromLonLat, getTransform } from 'ol/proj';
const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const transform = getTransform(mercator, equirectangular);

export default class CommandEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      OtherCommands: null,
      podCommands: null,
      showDetails: false
    };
  }

  componentDidMount() {
    const { sna } = this.props;
    const us = this;
  }

  componentWillUnmount() {}

  handleParamChange(paramIndex, event) {
    const { updateCommandParameter } = this.props;
    updateCommandParameter(paramIndex, event.target.value);
  }

  getUpdateCommandParameters() {
    const us = this;
    const { sna } = this.props;
    const { command, updateCommandField } = this.props;
    return function updateCommandParameters(formData) {
      let params;
      switch (command.type) {
        case 'formation':
          params = AxForm.formDataToParams(
            (sna.getPodCommandSchema(command.formationType) || {}).parameters,
            formData
          );
          updateCommandField('formationParameters', params);
          break;
        case 'other':
          params = AxForm.formDataToParams(
            (sna.getOtherCommandSchema(command.OtherCommand) || {}).parameters,
            formData
          );
          updateCommandField('parameters', params);
          break;
        default:
          params = [];
          updateCommandField('parameters', params);
          break;
      }
    };
  }

  selectWaypoint() {
    const { dataLayerCollection } = this.props;
    const wptInteraction = new OlSelect({
      condition: click,
      layers: dataLayerCollection.getArray()
    });
    const { updateCommandParameter, changeInteraction } = this.props;
    const us = this;
    wptInteraction.on('select', (e) => {
      const coords = e.selected[0].getGeometry().getCoordinates();
      // Formation params
      // lat, lon, bearing, sep
      updateCommandParameter(0, coords[1]);
      updateCommandParameter(1, coords[0]);
      changeInteraction();
    });
    changeInteraction(wptInteraction);
    info('Click on waypoint to set position');
  }

  // selectCoords()
  // Called when user clicks the "pin" icon, to set the coordinates of a formation
  selectCoords() {
    const { updateCommandParameter, dataLayerCollection, changeInteraction } = this.props;
    const us = this;
    const wptInteraction = new OlPointerInteraction({
      handleDownEvent: (e) => {
        const raw_coords = e.coordinate;
        // Formation params
        // lat, lon, bearing, sep
        const coords = transform(raw_coords)

        updateCommandParameter(0, coords[1]);
        updateCommandParameter(1, coords[0]);
        changeInteraction();
      }
    });
    changeInteraction(wptInteraction, 'crosshair');
    info('Click on map to set position');
  }

  selectHeading() {
    const { dataLayerCollection, changeInteraction } = this.props;
    const us = this;
    const wpt1Interaction = new OlSelect({
      condition: click,
      layers: dataLayerCollection.getArray()
    });
    wpt1Interaction.on('select', (e) => {
      const coords1 = e.selected[0].getGeometry().getCoordinates();
      const wpt2Interaction = new OlSelect({
        condition: click,
        layers: dataLayerCollection.getArray()
      });
      wpt2Interaction.on('select', (e2) => {
        const coords2 = e2.selected[0].getGeometry().getCoordinates();
        const lat1 = coords1[1];
        const lon1 = coords1[0];
        const lat2 = coords2[1];
        const lon2 = coords2[0];
        const { azi1 } = geod.Inverse(lat1, lon1, lat2, lon2, geod.AZIMUTH);
        // Formation params
        // lat, lon, bearing, sep
        us.updateCommandParameter(2, azi1);
        changeInteraction();
      });
      changeInteraction(wpt2Interaction);
    });
    changeInteraction(wpt1Interaction);
  }

  zoomTo() {
    const { zoomToFormation } = this.props;
    const { command } = this.props;
    zoomToFormation(command.formationParameters);
  }

  updateCommandType(command) {
    const { updateCommandType } = this.props;
    if (updateCommandType !== null) updateCommandType(command);
  }

  // getFormationControl()
  // These are the buttons for selection formation position on map (the pin icon) & 
  // zooming to that position
  getFormationControl() {
    const {
      command, updateCommandField, updateCommandParameter, fixedType, sna, readOnly
    } = this.props;
    const { OtherCommands, podCommands, showDetails } = this.state;

    return (
      <div className="formationControl">
        {fixedType || readOnly || command.formationType !== 0 ? (
          <button
            type="button"
            className="not-a-button formationType"
            onClick={
              !fixedType && !readOnly
                ? this.updateCommandType.bind(this, {
                  type: '',
                  formationType: '0',
                  OtherCommand: '0'
                })
                : () => {}
            }
          >
            {(() => {
              switch (command.formationType) {
                case '5':
                  return (
                    <img src={cmdIconLineFormation} alt="Line Formation" width="60px" className="commandIcon" />
                  );
                case '6':
                  return (
                    <img
                      src={cmdIconCircleFormation}
                      alt="Circle Formation"
                      width="60px"
                      className="commandIcon"
                    />
                  );
                default:
                  return 'Unknown Formation';
              }
            })()}
          </button>
        ) : (
          <div className="form-group">
            <label className="col control-label" htmlFor="formationType">
              Formation Type
            </label>
            <select
              name="formationType"
              value={command.formationType}
              onChange={updateCommandField.bind(null, 'formationType')}
            >
              <option value="5">Line</option>
              <option value="6">Circle</option>
            </select>
          </div>
        )}
        {!readOnly ? (
          <button type="button" onClick={this.selectCoords.bind(this)}>
            <FontAwesomeIcon icon={faMapPin} />
          </button>
        ) : (
          ''
        )}
        {command.formationParameters[0] !== 0 || command.formationParameters[1] !== 0 ? (
          <button type="button" onClick={this.zoomTo.bind(this)}>
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </button>
        ) : (
          <button type="button" className="inactive">
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </button>
        )}
        {showDetails ? (
          <button
            type="button"
            className="detailsButton"
            onClick={() => {
              this.setState({ showDetails: false });
            }}
            title="Hide Details"
          >
            <FontAwesomeIcon icon={faEllipsisH} />
          </button>
        ) : (
          <button
            type="button"
            className="detailsButton"
            onClick={() => {
              this.setState({ showDetails: true });
            }}
            title="Show Details"
          >
            <FontAwesomeIcon icon={faEllipsisH} />
          </button>
        )}
        {showDetails ? (
          <div className="details">
            <dl>
              <dt>Latitude</dt>
              <dd>{command.formationParameters[0].toFixed(6) || 0}</dd>
              <dt>Longitude</dt>
              <dd>{command.formationParameters[1].toFixed(6) || 0}</dd>
              <dt>Heading</dt>
              <dd>{command.formationParameters[2] || 0}</dd>
              <dt>Separation</dt>
              <dd>{command.formationParameters[3] || 0}</dd>
            </dl>
          </div>
        ) : (
          ''
        )}
      </div>
    )  
  }

  getOtherCommandName(id) {
    const { sna } = this.props
    const { OtherCommands } = this.state
  
    if (Array.isArray(OtherCommands)) {
      const command = sna.getOtherCommandById(parseInt(id, 10))
      if (command !== null) {
        if (command.name) {
          // Forgive me
          if (command.name == "Jump") {
            return "Return Home"
          }

          return command.name
        }
      }
    }

    return 'Unable to find command description'
  }


  getOtherCommandControl() {
    const {
      command, updateCommandField, updateCommandParameter, fixedType, sna, readOnly
    } = this.props;
    const { OtherCommands, podCommands, showDetails } = this.state;
  
    return (
      <div id="sendOtherCommand">
        {fixedType || readOnly || command.OtherCommand ? (
          <h2>
            { this.getOtherCommandName(command.OtherCommand) }
          </h2>
        ) : (
          <div className="form-group">
            <label className="col control-label" htmlFor="otherCmdSelect">
              Command
            </label>
            <select
              name="otherCmdSelect"
              value={command.OtherCommand ? command.OtherCommand : ''}
              onChange={updateCommandField.bind(null, 'OtherCommand')}
            >
              <option key="" value="" />
              {Array.isArray(OtherCommands) ? (
                OtherCommands.map(command => (
                  <option key={command.id} value={command.id}>
                    {command.name}
                  </option>
                ))
              ) : (
                <option value="">Unable to list commands</option>
              )}
            </select>
          </div>
        )}
        <div id="OtherCommandsParameters">
          {command.OtherCommand !== null
          && sna.getOtherCommandById(command.OtherCommand).parameters.length > 0 ? (
            <div>
              <AxForm
                key={command.OtherCommand}
                schema={sna.getOtherCommandById(command.OtherCommand).parameters}
                initialValues={
                  Array.isArray(command.parameters)
                    ? command.parameters.reduce((accum, current, index, array) => {
                      accum.push([index.toString(), current]);
                      return accum;
                    }, [])
                    : []
                }
                onChange={this.getUpdateCommandParameters()}
                readOnly={readOnly}
              />
            </div>
            ) : (
              ''
            )}
        </div>
      </div>
    )
  }

  getCompositeCommandControl() {
    const {
      command, updateCommandField, updateCommandParameter, fixedType, sna, readOnly
    } = this.props;
    const { OtherCommands, podCommands, showDetails } = this.state;
  
    return (
      <div id="sendCompositeCommand">
        {fixedType || readOnly || command.compositeType ? (
          <h2>
            {isValidCompositeType(command.compositeType)
              ? getCompositeTypeDescription(command.compositeType)
                || 'Unable to find command description'
              : 'Unable to find command description'}
          </h2>
        ) : (
          <div className="form-group">
            <label className="col control-label" htmlFor="compositeCmdSelect">
              Command
            </label>
            <select
              name="compositeCmdSelect"
              value={command.compositeType ? command.compositeType : ''}
              onChange={updateCommandField.bind(null, 'compositeType')}
            >
              <option key="" value="" />
              {Array.isArray(compositeCommands) ? (
                compositeCommands.map(command => (
                  <option key={command.id} value={command.id}>
                    {command.name}
                  </option>
                ))
              ) : (
                <option value="">Unable to list commands</option>
              )}
            </select>
          </div>
        )}
        <div id="compositeCommandsParameters">
          {command.compositeType !== null
          && getCompositeCommandByType(command.compositeType).parameters.length > 0 ? (
            <div>
              <AxForm
                key={command.compositeType}
                schema={getCompositeCommandByType(command.compositeType).parameters}
                initialValues={
                  Array.isArray(command.parameters)
                    ? command.parameters.reduce((accum, current, index, array) => {
                      accum.push([index.toString(), current]);
                      return accum;
                    }, [])
                    : []
                }
                onChange={this.getUpdateCommandParameters()}
                readOnly={readOnly}
              />
            </div>
            ) : (
              ''
            )}
        </div>
      </div>
    )  
  }
  
  getWaitControl() {
    const { command } = this.props;
  
    return (
      <div>
        Wait for {command.parameters} minutes
      </div>
    )
  }
  
  getCommandControl() {
    switch(this.props.command.type) {
      case 'formation':
        return this.getFormationControl()
      case 'other':
        return this.getOtherCommandControl()
      case 'composite':
        return this.getCompositeCommandControl()
      case 'wait':
        return this.getWaitControl()
    }  
  }

  // Formation ids
  // line = 5, circle = 6
  // Formation params
  // lat, lon, bearing, sep

  // Other cmds:
  // Profile Dive: ID 2, params: depthTarget, dwellTime, interval
  // Bottom dive: ID 3, params: depthTarget
  // Drift dive: ID 4, params: depthTarget, dwellTime
  // Surface line: ID 5, params:
  // Beep ID 0, Jump ID 1

  render() {
    const {
      command, updateCommandField, updateCommandParameter, fixedType, sna, readOnly
    } = this.props;
    const { OtherCommands, podCommands, showDetails } = this.state;

    if (!OtherCommands || !podCommands) {
      return <div>Loading...</div>;
    }

    if (
      (command.type === 'formation' && sna.getPodCommandById(parseInt(command.formationType, 10)) === null)
      || (command.type === 'other' && sna.getOtherCommandById(parseInt(command.OtherCommand, 10)) === null)
    ) {
      return <div className="command-editor">Invalid Command</div>;
    }

    return (
      <div className="command-editor">
        <div className="commandTypeSelect">
          {fixedType || readOnly ? (
            <span />
          ) : (
            <div>
              {command.type === '' ? (
                <CommandTypeSelector callback={this.updateCommandType.bind(this)} />
              ) : (
                <button
                  type="button"
                  className="prependedButton change-command"
                  title="Change Command Type"
                  onClick={this.updateCommandType.bind(this, {
                    type: '',
                    formationType: '0',
                    OtherCommand: '0'
                  })}
                >
                  Change Command
                </button>
              )}
            </div>
          )}
          {
            this.getCommandControl()
          }
        </div>
      </div>
    );
  }
}

CommandEditor.propTypes = {
  command: PropTypes.shape({
    type: PropTypes.string,
    formationType: PropTypes.string,
    OtherCommand: PropTypes.string,
    parameters: PropTypes.arrayOf(PropTypes.number),
    formationParameters: PropTypes.arrayOf(PropTypes.number)
  }).isRequired,
  fixedType: PropTypes.bool,
  readOnly: PropTypes.bool,
  updateCommandType: PropTypes.func,
  updateCommandField: PropTypes.func.isRequired,
  updateCommandParameter: PropTypes.func.isRequired,
  sna: PropTypes.instanceOf(JaiaAPI).isRequired,
  changeInteraction: PropTypes.func.isRequired,
  dataLayerCollection: PropTypes.instanceOf(OlCollection).isRequired,
  zoomToFormation: PropTypes.func.isRequired
};

CommandEditor.defaultProps = {
  fixedType: false,
  readOnly: false,
  updateCommandType: null
};

/* eslint-disable react/jsx-no-bind */
/* eslint-disable no-nested-ternary */
/* eslint-disable prefer-destructuring */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUp,
  faStepForward,
  faArrowDown,
  faExpand,
  faPlus,
  faSync,
  faTimes,
  faArrowsAlt,
  faLocationArrow,
  faPlay,
  faPlayCircle,
  faMapPin,
  faMapMarkerAlt,
  faMapMarkedAlt,
  faTrashAlt
} from '@fortawesome/free-solid-svg-icons';
import {
  faCheckSquare,
  faSquare,
  faSave,
  faEdit,
  faFolderOpen,
  faClock,
  faListAlt
} from '@fortawesome/free-regular-svg-icons';

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

import JsonAPI from '../../common/JsonAPI';
import JaiaAPI from '../../common/JaiaAPI';

import AxForm from './AxForm';
import CommandEditor from './CommandEditor';

import downloadIcon from '../icons/download.png'

const GeographicLib = require('geographiclib');

const geod = GeographicLib.Geodesic.WGS84;

// For initiating a file download
function byteArrayToBase64(bytes) {
    var chArray = Array.prototype.map.call(bytes, 
                     function (byte) { return String.fromCharCode(byte); });

    return window.btoa(chArray.join(""));
}

var octetStreamMimeType = "application/octet-stream";

function tryAnchorDownload(fileBytes, fileName) {
    var aElement = document.createElement("a"),
        event;

    if ("download" in aElement) {
        aElement.setAttribute("download", fileName);
        aElement.href = "data:" + octetStreamMimeType + 
                        ";base64," + byteArrayToBase64(fileBytes);

        document.body.appendChild(aElement);
        event = document.createEvent("MouseEvents");
        event.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0,
                             false, false, false, false, 0, null);
        aElement.dispatchEvent(event);
        document.body.removeChild(aElement);

        return true;
    }

    return false;
}

export default class MissionEdit extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      OtherCommands: null,
      podCommands: null
    };
    this.updateActionField = this.updateActionField.bind(this);
    this.addNewAction = this.addNewAction.bind(this);
    this.clipboard = null;
    // this.handleParamChange = this.handleParamChange.bind(this);
  }

  componentDidMount() {
    const { sna } = this.props;
    const us = this;
  }

  componentWillUnmount() {}

  addNewAction() {
    const { missionPlan, updateMissionPlan } = this.props;
    const newAction = {
      type: '',
      formationType: '0',
      OtherCommand: '0',
      compositeType: '',
      parameters: [0, 0, 0],
      // Need reasonable default params so renderer doesn't crash
      formationParameters: [0, 0, 0, 10],
      triggerCondition: '0'
    };
    missionPlan.push(newAction);
    updateMissionPlan(missionPlan);
    const { $, setSelectedMissionAction } = this.props;
    setSelectedMissionAction(missionPlan.length - 1);
    $('.sequenceEditor').animate({ scrollTop: $('.sequenceEditor').prop('scrollHeight') }, 1000);
  }

  updateActionType(actionIndex, action) {
    const { missionPlan, updateMissionPlan } = this.props;
    missionPlan[actionIndex].type = action.type;
    missionPlan[actionIndex].formationType = action.formationType;
    missionPlan[actionIndex].OtherCommand = action.OtherCommand;
    updateMissionPlan(missionPlan);
  }

  getUpdateActionType(actionIndex) {
    return this.updateActionType.bind(this, actionIndex);
  }

  updateActionField(actionIndex, field, event) {
    const { missionPlan, updateMissionPlan } = this.props;
    if (!event || !event.target) {
      missionPlan[actionIndex][field] = event;
    } else {
      missionPlan[actionIndex][field] = event.target.value;
    }
    updateMissionPlan(missionPlan);
  }

  getUpdateActionField(actionIndex) {
    return this.updateActionField.bind(this, actionIndex);
  }

  updateActionDelay(actionIndex, unit, event) {
    const { missionPlan, updateMissionPlan } = this.props;
    const delay = parseInt(missionPlan[actionIndex].triggerCondition, 10);
    let hours = Math.floor(delay / (60 * 60 * 1000));
    let minutes = Math.floor((delay / (60 * 1000)) % 60);
    let seconds = Math.floor((delay / 1000) % 60);
    let changedValue = event.target.value;
    if (changedValue < 0) changedValue = 0;
    switch (unit) {
      case 'hours':
        hours = changedValue;
        break;
      case 'minutes':
        minutes = changedValue;
        break;
      case 'seconds':
        seconds = changedValue;
        break;
      default:
        console.error(`Invalid unit given for delay: ${unit}`);
        break;
    }
    const newDelay = hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000;
    missionPlan[actionIndex].triggerCondition = newDelay.toString();
    updateMissionPlan(missionPlan);
  }

  static moveTextCursorToEnd(evt) {
    setTimeout(((event) => {
      // eslint-disable-next-line no-multi-assign, no-param-reassign
      event.currentTarget.selectionStart = event.currentTarget.selectionEnd = 10000;
    }).bind(null, evt), 10);
  }

  updateActionParameter(actionIndex, paramIndex, value) {
    const { missionPlan, updateMissionPlan } = this.props;
    if (missionPlan[actionIndex].type === 'formation') {
      missionPlan[actionIndex].formationParameters[paramIndex] = parseFloat(value);
    } else {
      missionPlan[actionIndex].parameters[paramIndex] = parseFloat(value);
    }
    updateMissionPlan(missionPlan);
  }

  getUpdateActionParameter(actionIndex) {
    return this.updateActionParameter.bind(this, actionIndex);
  }

  executeMissionAction(actionIndex) {
    const { missionPlan, sendCommand } = this.props;
    const action = missionPlan[actionIndex];
    sendCommand(action);
  }

  deleteMissionAction(actionIndex) {
    const { missionPlan, updateMissionPlan } = this.props;
    missionPlan.splice(actionIndex, 1);
    updateMissionPlan(missionPlan);
  }
  
  copyAction(actionIndex) {
    const { selectedMissionAction, missionPlan } = this.props
    this.clipboard = missionPlan[selectedMissionAction]
    console.log("Copied mission action = " + this.clipboard)
  }
  
  pasteAction(actionIndex) {
    const { missionPlan } = this.props
    missionPlan.splice(actionIndex+1, 0, this.clipboard)
    console.log("Pasted mission action = " + this.clipboard)
  }

  moveMissionActionLater(actionIndex) {
    const { missionPlan, updateMissionPlan } = this.props;
    if (actionIndex >= missionPlan.length - 1) {
      console.error('Cannot move mission action beyond last position');
      return;
    }
    missionPlan[actionIndex + 1] = missionPlan.splice(actionIndex, 1, missionPlan[actionIndex + 1])[0];
    updateMissionPlan(missionPlan);
    const { setSelectedMissionAction } = this.props;
    setTimeout(setSelectedMissionAction.bind(null, actionIndex + 1), 100);
  }

  moveMissionActionEarlier(actionIndex) {
    const { missionPlan, updateMissionPlan } = this.props;
    if (actionIndex <= 0) {
      console.error('Cannot move mission action beyond first position');
      return;
    }
    missionPlan[actionIndex] = missionPlan.splice(actionIndex - 1, 1, missionPlan[actionIndex])[0];
    updateMissionPlan(missionPlan);
    const { setSelectedMissionAction } = this.props;
    setTimeout(setSelectedMissionAction.bind(null, actionIndex - 1), 100);
  }

  sortByTime() {
    const { updateMissionPlan } = this.props;
    let { missionPlan } = this.props;
    missionPlan = missionPlan.sort((firstEl, secondEl) => (parseInt(firstEl.triggerCondition, 10) > parseInt(secondEl.triggerCondition, 10)
      ? 1
      : parseInt(firstEl.triggerCondition, 10) < parseInt(secondEl.triggerCondition, 10)
        ? -1
        : 0));
    updateMissionPlan(missionPlan);
  }

  zoomToMission() {
    const { zoomToFileLayerExtent } = this.props;
    zoomToFileLayerExtent();
  }
  
  // Allows user to download the mission plan in JSON format
  downloadMission() {
    const { missionName, missionPlan } = this.props
    
    let json = JSON.stringify(missionPlan)
    
    var enc = new TextEncoder()
    let data = enc.encode(json)

    tryAnchorDownload(data, missionName + ".json")
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
      missionPlan,
      sna,
      changeInteraction,
      dataLayerCollection,
      readOnly,
      executeMissionPlan,
      selectedMissionAction,
      activeMissionAction,
      setSelectedMissionAction,
      zoomToFormation,
      execNextMissionAction
    } = this.props;
    const { OtherCommands, podCommands } = this.state;

    if (!OtherCommands || !podCommands) {
      return <div>Loading...</div>;
    }

    function toggleSelectedMissionAction(index) {
      if (index == selectedMissionAction) {
        setSelectedMissionAction(null)
      }
      else {
        setSelectedMissionAction(index)
      }
    }

    function stepName(index) {
      return <span style={{'padding-left': '8px'}} onClick={ toggleSelectedMissionAction.bind(null, index) }>
                {"Step " + (index + 1)} 
             </span>;
    }


    return (
      <div id="missionSequenceEditor">
        {!readOnly ? (
          <span>
            <button type="button" title="Center Map" onClick={this.zoomToMission.bind(this)}>
              <FontAwesomeIcon icon={faMapMarkedAlt} /> Center Map
            </button>
            <button type="button" title="Download" onClick={this.downloadMission.bind(this)}>
              <img src={downloadIcon} alt="Download" width="22" height="22" /> Download
            </button>
          </span>
        ) : (
          ''
        )}
        <div className="sequenceEditor" onClick={setSelectedMissionAction.bind(null, null)}>
          {missionPlan && missionPlan.length > 0 ? (
          
            // List of Steps
            missionPlan.map((missionAction, index, array) => (
              <div
                key={index}
                className={`sequenceItem${index === selectedMissionAction ? ' selected' : ''}${
                  index === activeMissionAction ? ' active' : ''
                }`}
                onClick={ (event) => 
                  {
                    setSelectedMissionAction(index)
                    event.stopPropagation()
                  }
                }
              >
                {
                // Trigger type selected
                (
                  <div>
                    {(readOnly || index != selectedMissionAction) ? (
                      <div className="action-condition" onClick={ toggleSelectedMissionAction.bind(null, index) }>
                        <FontAwesomeIcon icon={faListAlt} />
                    {stepName(index)}
                      </div>
                    ) : (
                      <div className="action-condition" onClick={ toggleSelectedMissionAction.bind(null, index) }>
                        <button type="button">
                          <FontAwesomeIcon icon={faListAlt} />
                        </button>
                      {stepName(index)}
                      </div>
                    )}
                    
                    <CommandEditor
                      key={missionAction}
                      command={missionAction}
                      updateCommandField={this.getUpdateActionField(index)}
                      updateCommandParameter={this.getUpdateActionParameter(index)}
                      updateCommandType={this.getUpdateActionType(index)}
                      sna={sna}
                      changeInteraction={changeInteraction}
                      dataLayerCollection={dataLayerCollection}
                      readOnly={(readOnly || index !== selectedMissionAction)}
                      zoomToFormation={zoomToFormation.bind(null, index)}
                    />
                    {!(readOnly || index != selectedMissionAction) ? (
                      <div className="actionActions">
                        <button type="button" className="execute" onClick={this.executeMissionAction.bind(this, index)}>
                          <FontAwesomeIcon icon={faPlayCircle} />
                        </button>
                        <button type="button" className="copy" onClick={this.copyAction.bind(this, index)}>
                          Copy
                        </button>
                        { this.clipboard !== null ? (
                          <button type="button" className="paste" onClick={this.pasteAction.bind(this, index)}>
                            Paste
                          </button>
                        ) : ('') }
                        <button type="button" className="delete" onClick={this.deleteMissionAction.bind(this, index)}>
                          <FontAwesomeIcon icon={faTrashAlt} />
                        </button>
                        {index > 0 ? (
                          <button
                            type="button"
                            className="arrow-up"
                            onClick={this.moveMissionActionEarlier.bind(this, index)}
                            title="Move Up"
                          >
                            <FontAwesomeIcon icon={faArrowUp} />
                          </button>
                        ) : (
                          ''
                        )}
                        {index < array.length - 1 ? (
                          <button
                            type="button"
                            className="arrow-down"
                            onClick={this.moveMissionActionLater.bind(this, index)}
                            title="Move Down"
                          >
                            <FontAwesomeIcon icon={faArrowDown} />
                          </button>
                        ) : (
                          ''
                        )}
                      </div>
                    ) : (
                      <div className="actionActions">
                        {index === activeMissionAction && execNextMissionAction ? (
                          <button type="button" onClick={execNextMissionAction} title="Skip">
                            <FontAwesomeIcon icon={faStepForward} />
                          </button>
                        ) : (
                          ''
                        )}
                      </div>
                    ) /* end edit buttons */}
                  </div>
                )}
              </div>
            )) // End missionPlan.map
          ) : (
            <div className="sequenceItem">No mission actions.</div>
          )}
          
          <button type="button" style={{'margin': '12px'}} onClick={ (event) => 
            {
              this.addNewAction()
              event.stopPropagation()
            }
          } title="Add Mission Action">
            <FontAwesomeIcon icon={faPlus} /> Action
          </button>

        </div>

      </div>
    );
  }
  
  
}

MissionEdit.propTypes = {
  missionPlan: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      formationType: PropTypes.string,
      OtherCommand: PropTypes.string,
      parameters: PropTypes.arrayOf(PropTypes.number),
      triggerCondition: PropTypes.string
    })
  ).isRequired,
  updateMissionPlan: PropTypes.func.isRequired,
  sna: PropTypes.instanceOf(JaiaAPI).isRequired,
  changeInteraction: PropTypes.func.isRequired,
  dataLayerCollection: PropTypes.instanceOf(OlCollection).isRequired,
  readOnly: PropTypes.bool,
  executeMissionPlan: PropTypes.func,
  selectedMissionAction: PropTypes.number,
  activeMissionAction: PropTypes.number,
  zoomToFileLayerExtent: PropTypes.func.isRequired,
  setSelectedMissionAction: PropTypes.func,
  execNextMissionAction: PropTypes.func,
  zoomToFormation: PropTypes.func.isRequired,
  $: PropTypes.func.isRequired,
  sendCommand: PropTypes.func.isRequired
};

MissionEdit.defaultProps = {
  readOnly: false,
  executeMissionPlan: null,
  selectedMissionAction: -1,
  activeMissionAction: -1,
  setSelectedMissionAction: null,
  execNextMissionAction: null
};

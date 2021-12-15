/* eslint-disable no-unused-vars */

import React from 'react';

import $ from 'jquery';
import 'jquery-ui/ui/widgets/slider';
import 'jquery-ui/themes/base/slider.css';

import JaiaAPI from '../../common/JaiaAPI';

import AxForm from './AxForm';

const PropTypes = require('prop-types');
import { info } from '../libs/notifications'

export default class PodControl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      standardCommands: [],
      OtherCommands: null,
      podCommands: null,
      selectedStandardCommand: null,
      selectedOtherCommand: null,
      selectedPodCommand: null
    };
    this.sendStandardCommand = this.sendStandardCommand.bind(this);
    this.sendOtherCommand = this.sendOtherCommand.bind(this);
    this.sendPodCommand = this.sendPodCommand.bind(this);
    this.didSend = function(id, params) {
      info("Sent Command")
    }
  }

  componentDidMount() {
    const { sna } = this.props;
    const us = this;
  }

  componentWillUnmount() {}

  /*
  sendHeading(heading) {
    const { desiredThrottle } = this.state;
    this.setState({ desiredHeading: heading });
    this.sendManualControl(heading, desiredThrottle);
  }
  */

  setSelectedStandardCommand(event) {
    const selectedCmdId = event.target.value;
    const { standardCommands } = this.state;
    for (let i = 0; i < standardCommands.length; i += 1) {
      if (standardCommands[i].id.toString() === selectedCmdId) {
        this.setState({ selectedStandardCommand: standardCommands[i] });
        return;
      }
    }
  }

  setSelectedOtherCommand(event) {
    const selectedCmdId = event.target.value;
    const { OtherCommands } = this.state;
    for (let i = 0; i < OtherCommands.length; i += 1) {
      if (OtherCommands[i].id.toString() === selectedCmdId) {
        this.setState({ selectedOtherCommand: OtherCommands[i] });
        return;
      }
    }
  }

  setSelectedPodCommand(event) {
    const selectedCmdId = event.target.value;
    const { podCommands } = this.state;
    for (let i = 0; i < podCommands.length; i += 1) {
      if (podCommands[i].id.toString() === selectedCmdId) {
        this.setState({ selectedPodCommand: podCommands[i] });
        return;
      }
    }
  }

  sendStandardCommand(data) {
    const { sna } = this.props;
    const { selectedStandardCommand } = this.state;
    // params must be an array of numeric values and not strings
    const params = AxForm.formDataToParams(selectedStandardCommand.parameters, data);
    console.log(params);
    sna.sendStandardCommand(selectedStandardCommand.id, params);
    this.didSend(selectedStandardCommand.id, params)
  }

  sendOtherCommand(data) {
    const { sna } = this.props;
    const { selectedOtherCommand } = this.state;
    // params must be an array of numeric values and not strings
    const params = AxForm.formDataToParams(selectedOtherCommand.parameters, data);
    console.log(params);
    sna.sendOtherCommand(selectedOtherCommand.id, params);
    this.didSend(selectedOtherCommand.id, params)
  }

  sendPodCommand(data) {
    const { sna } = this.props;
    const { selectedPodCommand } = this.state;
    // params must be an array of numeric values and not strings
    const params = AxForm.formDataToParams(selectedPodCommand.parameters, data);
    console.log(params);
    sna.sendPodCommand(selectedPodCommand.id, params);
    this.didSend(selectedPodCommand.id, params)
  }

  sendStop() {
    const { sna } = this.props;
    sna.sendStop();
  }

  render() {
    const {
      error,
      standardCommands,
      OtherCommands,
      podCommands,
      selectedStandardCommand,
      selectedOtherCommand,
      selectedPodCommand
    } = this.state;
    return (
      <div>
        {error || ''}
        <button type="button" style={{"backgroundColor":"red"}} onClick={this.sendStop.bind(this)}>
          Stop
        </button>
        <fieldset>
          <legend>Standard Commands</legend>
          <div id="sendStandardCommand">
            Command:
            {' '}
            <select
              name="standardCmdSelect"
              value={selectedStandardCommand ? selectedStandardCommand.id : ''}
              onChange={this.setSelectedStandardCommand.bind(this)}
            >
              <option key="" value="" />
              {Array.isArray(standardCommands)
                ? standardCommands.map(command => (
                  <option key={command.id} value={command.id} title={command.description}>
                    {command.name}
                  </option>
                ))
                : ''}
            </select>
            <div id="standardCommandsParameters">
              {selectedStandardCommand ? (
                <div>
                  <div>
                    Command Description:
                    {' '}
                    {selectedStandardCommand.description}
                  </div>
                  <div>
                    <div>Command Options:</div>
                    <AxForm
                      key={selectedStandardCommand.id}
                      schema={selectedStandardCommand.parameters}
                      onSubmit={this.sendStandardCommand}
                    />
                  </div>
                </div>
              ) : (
                'Select a standard command'
              )}
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Other Commands</legend>
          <div id="sendOtherCommand">
            <div>
              Command:
              {' '}
              <select
                name="otherCmdSelect"
                value={selectedOtherCommand ? selectedOtherCommand.id : ''}
                onChange={this.setSelectedOtherCommand.bind(this)}
              >
                <option key="" value="" />
                {Array.isArray(OtherCommands)
                  ? OtherCommands.map(command => (
                    <option key={command.id} value={command.id}>
                      {command.name}
                    </option>
                  ))
                  : ''}
              </select>
            </div>
            <div>
              Command Options:
              <div id="OtherCommandsParameters">
                {selectedOtherCommand ? (
                  <AxForm
                    key={selectedOtherCommand.id}
                    schema={selectedOtherCommand.parameters}
                    onSubmit={this.sendOtherCommand}
                  />
                ) : (
                  'Select a other command'
                )}
              </div>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Pod Commands</legend>
          <div id="sendPodCommand">
            <div>
              Command:
              {' '}
              <select
                name="podCmdSelect"
                value={selectedPodCommand ? selectedPodCommand.id : ''}
                onChange={this.setSelectedPodCommand.bind(this)}
              >
                <option key="" value="" />
                {Array.isArray(podCommands)
                  ? podCommands.map(command => (
                    <option key={command.id} value={command.id}>
                      {command.name}
                    </option>
                  ))
                  : ''}
              </select>
            </div>
            <div>
              Command Options:
            </div>
            <div id="podCommandsParameters">
              {selectedPodCommand ? (
                <AxForm
                  key={selectedPodCommand.id}
                  schema={selectedPodCommand.parameters}
                  onSubmit={this.sendPodCommand}
                />
              ) : (
                'Select a pod command'
              )}
            </div>
          </div>
        </fieldset>
      </div>
    );
  }
}

PodControl.propTypes = {
  sna: PropTypes.instanceOf(JaiaAPI).isRequired
};

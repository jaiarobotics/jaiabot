/* eslint-disable quote-props */
require('es6-promise').polyfill();
require('isomorphic-fetch');

const OTHER_COMMAND_NAMES = {
  '0': 'Temp',
  '1': 'Temp',
  '2': 'Temp',
  '3': 'Temp',
  '4': 'Temp',
  '5': 'Temp',
  '10': 'Temp',
  '11': 'Temp',
};

const OTHER_COMMAND_PARAMETER_NAMES = {
  '2': {
    '0': 'Temp',
    '1': 'Temp',
    '2': 'Temp'
  },
  '3': {
    '0': 'Temp'
  },
  '4': {
    '0': 'Temp',
    '1': 'Temp'
  }
};

const OTHER_COMMAND_PARAMETER_UNITS = {
  '2': {
    '0': 'm',
    '1': 's',
    '2': 'm'
  },
  '3': {
    '0': 'm'
  },
  '4': {
    '0': 'm',
    '1': 's'
  }
};

const OTHER_COMMAND_PARAMETER_ORDER = {
  '2': {
    '0': 0,
    '1': 2,
    '2': 1
  },
  '3': {
    '0': 0
  },
  '4': {
    '0': 0,
    '1': 1
  }
};

module.exports = class JaiaAPI {
  constructor(url = 'http://192.168.42.1:5000/jaia', clientId = null, debug = false) {
    this.url = url;
    if (clientId) {
      this.clientId = clientId;
    } else {
      this.clientId = Math.floor(Math.random() * Math.floor(2 ** 30));
    }

    this.standardCommands = null;
    this.OtherCommands = null;
    this.podCommands = null;

    this.debug = debug;
    this.commonGetOpts = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };
    this.commonPostOpts = {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    };
  }

  hit(method, endpoint, requestBody) {
    if (this.debug) {
      console.log(`Request endpoint: ${method} ${this.url}/${endpoint}`);
      console.log(`Request body: ${JSON.stringify(requestBody)}`);
    }
    return fetch(`${this.url}/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(requestBody)
    })
      .then(
        (response) => {
          if (response.ok) {
            try {
              return response.json();
            } catch (error) {
              console.error('Error parsing response json');
              console.error(error);
              return response.text();
            }
          }
	  if (this.debug) {
	    console.error(`Error from ${method} to JaiaAPI: ${response.status} ${response.statusText}`);
	  }
          return Promise.reject(
            new Error(`Error from ${method} to JaiaAPI: ${response.status} ${response.statusText}`)
          );
        },
        (reason) => {
          console.error(`Failed to ${method} JSON request: ${reason}`);
          console.error('Request body:');
          console.error(requestBody);
          return Promise.reject(new Error('Response parse fail'));
        }
      )
      .then(
        (res) => {
          if (this.debug) console.log(`JaiaAPI Response: ${res.code} ${res.msg}`);
          return res;
        },
        reason => reason
      );
  }

  post(endpoint, body) {
    return this.hit('POST', endpoint, body);
  }

  get(endpoint, body) {
    return this.hit('GET', endpoint, body);
  }

  getOldStatus() {
    return this.get('getStatus');
  }

  getStatus() {
    return this.get('status')
  }

  setControlId(id = -1, rcMode = 0) {
    return this.post('setManualID', {
      botID: id,
      rcMode,
      browser_id: this.clientId
    });
  }

  allStop() {
    this.post('allStop', null)
  }

  postCommand(command) {
    return this.post('command', command)
  }

  sendManualControl(heading, speed, altitude) {
    return this.post('setManualControl', {
      altitude: parseInt(altitude, 10),
      speed: parseInt(speed, 10),
      heading: parseInt(heading, 10)
    });
  }

  sendStandardCommand(id, parameters) {
    return this.post('setStandardCommand', {
      selectionID: parseInt(id, 10),
      parameters
    });
  }

  getOtherCommandSchema(id) {
    if (this.OtherCommands) {
      const { OtherCommands } = this;
      for (let i = 0; i < OtherCommands.length; i += 1) {
        if (parseInt(OtherCommands[i].id, 10) === parseInt(id, 10)) {
          return OtherCommands[i];
        }
      }
      return null;
    }
    this.getOtherCommands();
    return null;
  }

  getPodCommandSchema(id) {
    if (this.podCommands) {
      const { podCommands } = this;
      for (let i = 0; i < podCommands.length; i += 1) {
        if (parseInt(podCommands[i].id, 10) === parseInt(id, 10)) {
          return podCommands[i];
        }
      }
      return null;
    }
    this.getOtherCommands();
    return null;
  }

  sendOtherCommand(id, parameters) {
    return this.post('setOtherCommand', {
      selectionID: parseInt(id, 10),
      parameters
    });
  }

  static convertCommandSchema(
    command,
    nameOverrides = null,
    paramNameOverrides = null,
    paramUnitOverrides = null,
    paramOrderOverrides = null
  ) {
    const outCommand = {};
    outCommand.id = command.selectionID.toString();
    if (nameOverrides && Reflect.has(nameOverrides, outCommand.id)) {
      outCommand.name = nameOverrides[outCommand.id];
    } else {
      outCommand.name = command.name;
    }
    outCommand.description = command.helpText;
    outCommand.parameters = [];
    if (Reflect.has(command, 'parameters') && Array.isArray(command.parameters)) {
      command.parameters.forEach((parameter) => {
        const outParam = {};
        outParam.name = parameter.paramID.toString();
        outParam.type = 'float';
        outParam.defaultValue = parameter.defaultValue;
        outParam.helpText = parameter.helpText;
        if (
          paramNameOverrides
          && Reflect.has(paramNameOverrides, outCommand.id)
          && Reflect.has(paramNameOverrides[outCommand.id], outParam.name)
        ) {
          outParam.description = paramNameOverrides[outCommand.id][outParam.name];
        } else {
          outParam.description = parameter.paramName;
        }
        if (
          paramUnitOverrides
          && Reflect.has(paramUnitOverrides, outCommand.id)
          && Reflect.has(paramUnitOverrides[outCommand.id], outParam.name)
        ) {
          outParam.units = paramUnitOverrides[outCommand.id][outParam.name];
        } else {
          outParam.units = '';
        }
        if (
          paramOrderOverrides
          && Reflect.has(paramOrderOverrides, outCommand.id)
          && Reflect.has(paramOrderOverrides[outCommand.id], outParam.name)
        ) {
          outParam.order = paramOrderOverrides[outCommand.id][outParam.name];
        } else {
          outParam.order = 0;
        }
        outParam.inputOptions = {
          min: parameter.minValue,
          max: parameter.maxValue,
          step: 10 ** -parameter.numDecimals
        };
        outCommand.parameters.push(outParam);
      });
    }
    return outCommand;
  }

  getOtherCommands() {
    if (this.OtherCommands) {
      return Promise.resolve(this.OtherCommands);
    }
    const us = this;
    return this.get('getOtherCommands').then(
      (response) => {
        if (!Array.isArray(response)) {
          if (response.code !== 0) {
            return Promise.reject(new Error(`SNA Response code not success: ${response.code}`));
          }
          return Promise.reject(new Error(`SNA Response code: ${response.code}`));
        }
        const commands = [];
        response.forEach((command) => {
          commands.push(
            JaiaAPI.convertCommandSchema(
              command,
              OTHER_COMMAND_NAMES,
              OTHER_COMMAND_PARAMETER_NAMES,
              OTHER_COMMAND_PARAMETER_UNITS,
              OTHER_COMMAND_PARAMETER_ORDER
            )
          );
        });
        us.OtherCommands = commands;
        return Promise.resolve(commands);
      },
      failReason => Promise.reject(failReason)
    );
  }

  getOtherCommandById(id) {
    if (!this.OtherCommands) {
      return null;
    }
    for (let i = 0; i < this.OtherCommands.length; i += 1) {
      if (this.OtherCommands[i].id === id.toString()) {
        return this.OtherCommands[i];
      }
    }
    return null;
  }

  sendPodCommand(id, parameters) {
    const params = [];
    for (let i = 0; i < parameters.length; i += 1) {
      params[i] = Math.round(parameters[i] * 1e6) / 1e6;
    }
    // Fix formation angle
    if ((id === '5' || id === '6') && params[2] < 0) params[2] += 360.0;
    return this.post('podAlg', {
      selectionID: parseInt(id, 10),
      parameters: params
    });
  }

  getPodCommandById(id) {
    if (!this.podCommands) {
      return null;
    }
    for (let i = 0; i < this.podCommands.length; i += 1) {
      if (this.podCommands[i].id === id.toString()) {
        return this.podCommands[i];
      }
    }
    return null;
  }

  sendClientLocation(locationValid, latitude, longitude) {
    return this.post('setControllerStatus', {
      locationValid: locationValid === true || locationValid.toString().toLowerCase() === 'true',
      latitude: Math.round(parseFloat(latitude) * 1000000) / 1000000,
      longitude: Math.round(parseFloat(longitude) * 1000000) / 1000000,
      browser_id: this.clientId
    });
  }

  static getBatteryStateDescription(batteryState) {
    switch (batteryState) {
      default:
        return 'To Do!';
    }
  }

  static getStateDescription(otherMarker) {
    switch (otherMarker) {
      default:
        return '<span title="">Unknown</span>';
    }
  }

  static getFaultStateDescription(faultState) {
    switch (faultState) {
      default:
        return '<span title="">Unknown</span>';
    }
  }

  static getCommunicationStateDescription(commState) {
    switch (commState) {
      default:
        return '<span title="">Unknown</span>';
    }
  }

  static getCommandStateDescription(commandState) {
    switch (commandState) {
      default:
        return '<span title="">Unknown</span>';
    }
  }

};

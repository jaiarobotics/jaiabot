/* eslint-disable quote-props */
require('es6-promise').polyfill();
require('isomorphic-fetch');

import { GeoJSON } from 'ol/format';
import { Command, Engineering, CommandForHub } from '../../shared/JAIAProtobuf';
import { randomBase57, convertHTMLStrDateToISO } from '../client/components/shared/Utilities';

export class JaiaAPI {
  clientId: string
  url: string
  debug: boolean
  headers: {[key: string]: string}

  constructor(clientId: string, url = 'http://192.168.42.1:5000', debug = true) {
    this.clientId = clientId
    console.debug(`JaiaAPI clientId = ${clientId}`)
    this.url = url;

    this.debug = debug;
    this.headers = {
      'Content-Type' : 'application/json; charset=utf-8',
      'clientId': this.clientId
    }
  }

  hit(method: string, endpoint: string, requestBody?: any) {
    if (this.debug) {
      console.log(`Request endpoint: ${method} ${this.url}${endpoint}`);
      console.log(`Request body: ${JSON.stringify(requestBody)}`);
    }
    return fetch(`${this.url}${endpoint}`, {
             method,
             headers : this.headers,
             body : JSON.stringify(requestBody)
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
                console.error(`Error from ${method} to JaiaAPI: ${
                    response.status} ${response.statusText}`);
              }
              return Promise.reject(
                  new Error(`Error from ${method} to JaiaAPI: ${
                      response.status} ${response.statusText}`));
            },
            (reason) => {
              console.error(`Failed to ${method} JSON request: ${reason}`);
              console.error('Request body:');
              console.error(requestBody);
              return Promise.reject(new Error('Response parse fail'));
            })
        .then((res) => {
          if (this.debug)
            console.log(`JaiaAPI Response: ${res.code} ${res.msg}`);
          return res;
        }, reason => reason);
  }

  post(endpoint: string, body?: any) {
    return this.hit('POST', endpoint, body);
  }

  get(endpoint: string) {
    return this.hit('GET', endpoint);
  }

  getMetadata() { return this.get('jaia/metadata') }

  getStatus() { return this.get('jaia/status') }

  /**
   * 
   * @param startDate yyyy-mm-dd hh:mm
   * @param endDate yyyy-mm-dd hh:mm
   * @returns Array of TaskPackets
   */
  getTaskPackets(startDate?: string, endDate?: string) { 
    if (startDate && endDate) {
        const startDateStr = convertHTMLStrDateToISO(startDate)
        const endDateStr = convertHTMLStrDateToISO(endDate)
        return this.get(`jaia/task-packets?startDate=${startDateStr}&endDate=${endDateStr}`)
    } else {
        // Let server set default date values
        return this.get(`jaia/task-packets`)
    }
  }

  getTaskPacketsCount() {
      return this.get(`jaia/task-packets-count`)
  }

  getDepthContours(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
        const startDateStr = convertHTMLStrDateToISO(startDate)
        const endDateStr = convertHTMLStrDateToISO(endDate)
      return this.get(`jaia/depth-contours?startDate=${startDateStr}&endDate=${endDateStr}`)
    } else {
      // Let server set default date values
      return this.get(`jaia/depth-contours`)
    }
  }

  /**
   * Gets a GeoJSON object with interpolated drift features
   * @date 10/5/2023 - 5:22:32 AM
   *
   * @returns {*} A GeoJSON feature set containing interpolated drift features
   */
  getDriftMap(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      const startDateStr = convertHTMLStrDateToISO(startDate)
      const endDateStr = convertHTMLStrDateToISO(endDate)
      return (
        this.get(`jaia/drift-map?startDate=${startDateStr}&endDate=${endDateStr}`).then((geoJSON) => {
          const features = new GeoJSON().readFeatures(geoJSON)
          return features
        })
      )
    } else {
      // Let server set default date values
      return (
        this.get(`jaia/drift-map`).then((geoJSON) => {
          const features = new GeoJSON().readFeatures(geoJSON)
          return features
        })
      )
    } 
  }

  allStop() { return this.post('jaia/all-stop') }

  allActivate() { return this.post('jaia/all-activate', null) }

  nextTaskAll() { return this.post('jaia/next-task-all', null) }

  allRecover() { return this.post('jaia/all-recover', null) }

  postCommand(command: Command) { return this.post('jaia/command', command) }

  postCommandForHub(command: CommandForHub) { return this.post('jaia/command-for-hub', command) }

  postEngineeringPanel(engineeringPanelCommand: Engineering) {
      return this.post('jaia/ep-command', engineeringPanelCommand)
  }

  takeControl() { return this.post('jaia/take-control', null) }

  postEngineering(engineeringCommand: Engineering) {
    return this.post('jaia/pid-command', engineeringCommand)
  }

  postMissionFilesCreate(descriptor: any) {
    return this.post('missionfiles/create', descriptor)
  }
}

export const jaiaAPI = new JaiaAPI(randomBase57(22), '/', false)

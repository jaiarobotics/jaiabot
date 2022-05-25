/* eslint-disable quote-props */
require('es6-promise').polyfill();
require('isomorphic-fetch');

module.exports = class JaiaAPI {
  constructor(url = 'http://192.168.42.1:5000/jaia', debug = false) {
    this.url = url;

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

  allStop() {
    return this.post('allStop', null)
  }

  postCommand(command) {
    return this.post('command', command)
  }

  postEngineering(engineeringCommand) {
    return this.post('pid-command', engineeringCommand)
  }
}

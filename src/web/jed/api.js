class JaiaAPI {

  constructor() {
      function randomBase57(stringLength) {
          const base75Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstvwxyz'
        
          var s = ''
          for (let i = 0; i < stringLength; i++) {
              s = s.concat(base75Chars[Math.floor(Math.random() * base75Chars.length)])
          }
          return s
      }
        
      this.inControl = true
      this.clientId = randomBase57(22) // UUID-length
      this.apiThrottleEndTime = 0 // Time after which it's safe to send commands, (for throttling)
      this.headers = {
          'clientId': this.clientId,
          'Content-Type': 'application/json'
      }
        
  }

  
  /**
   * Send an engineering command
   *
   * @param {*} command
   */
  sendEngineeringCommand(command, force=false) {
    if (!this.inControl) return
  
    if (!force && Date.now() < this.apiThrottleEndTime) {
      console.warn(`Dropped command: ${command}`)
      return
    }
  
    this.apiThrottleEndTime = Date.now() + 1000

    fetch('/jaia/engineering-command', {method: 'POST', headers: this.headers, body: JSON.stringify(command)})
    .then((response) => response.json())
    .then((response) => {
      if (response.status != 'ok') {
        alert(response.message)
      }
    })
  
  }

  
  /**
   * Return status of the fleet
   *
   * @returns {*}
   */
  getStatus() {
    return fetch('/jaia/status', {headers: this.headers})
    .then((response) => response.json())
    .then((status) => {
      this.inControl = (status.controllingClientId == this.clientId || status.controllingClientId == null)
      return status
    })
    .catch((e) => {
      alert(e)
    })
  }


  takeControl() {
    return fetch('/jaia/take-control', {
      method : 'POST',
      headers : this.headers
    }).then((response) => response.json())
  }

}

const api = new JaiaAPI()

export { JaiaAPI, api }

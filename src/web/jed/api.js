class JaiaAPI {

  constructor() {
      function randomBase57(stringLength) {
          const base57Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstvwxyz'
        
          var s = ''
          for (let i = 0; i < stringLength; i++) {
              s = s.concat(base57Chars[Math.floor(Math.random() * base57Chars.length)])
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
    if (!this.inControl) {
      console.log(`Not inControl: ${this.clientId}`)
      return
    }
  
    if (!force && Date.now() < this.apiThrottleEndTime) {
      return
    }
  
    this.apiThrottleEndTime = Date.now() + 1000

    return fetch('/jaia/engineering-command', {method: 'POST', headers: this.headers, body: JSON.stringify(command)})
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
      this.setControlBorder()
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

  setControlBorder() {
    let body = document.getElementById('body')
    if (this.inControl) {
      body.style.border = 'none'
    } else {
      body.style.border = '3px solid red'
    }
  }

}

const api = new JaiaAPI()

export { JaiaAPI, api }

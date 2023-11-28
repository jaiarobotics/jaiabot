var inControl = true

function setInControl(value) {
  inControl = value
}

function randomBase57(stringLength) {
  const base75Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstvwxyz'

  var s = ''
  for (let i = 0; i < stringLength; i++) {
      s = s.concat(base75Chars[Math.floor(Math.random() * base75Chars.length)])
  }
  return s
}


const clientId = randomBase57(22) // UUID-length
const headers = {
  'clientId' : clientId,
  'Content-Type' : 'application/json'
} 


function takeControl(evt) {
  fetch('/jaia/take-control', {
    method : 'POST',
    headers : {clientId : clientId}
  }).then((response) => response.json())
}


function sendCommand(command) {
  if (!inControl) return

  fetch('/jaia/pid-command', {method: 'POST', headers: headers, body: JSON.stringify(command)})
  .then((response) => response.json())
  .then((response) => {
    if (response.status != 'ok') {
      alert(response.message)
    }
  })
}

export {
  inControl,
  setInControl,
  clientId,
  headers,
  takeControl,
  sendCommand
}

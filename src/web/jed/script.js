let FINE_CONTROL_KEY = "ShiftRight"
let DEAD_MANS_SWITCH_KEY = "ShiftLeft"
let warningStatusInner = ""
//****** Changing the SAFE_BOT_SPEED may result in bot hardware failure   ****** 
//****** Please do not increase the SAFE_BOT_SPEED unless you know the  ****** 
//****** consequences                                                     ******
let SAFE_BOT_SPEED = 60;

function randomBase57(stringLength) {
  const base75Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstvwxyz'

  var s = ''
  for (let i = 0; i < stringLength; i++) {
      s = s.concat(base75Chars[Math.floor(Math.random() * base75Chars.length)])
  }
  return s
}


const clientId = randomBase57(22) // UUID-length
headers = {
  'clientId': clientId,
  'Content-Type': 'application/json'
}
var inControl = true

// Gets an element with this id
function el(id) {
  element = document.getElementById(id)
  if (!element) {
    console.warn("WARNING: Cannot locate element with id = ", id)
  }
  return element
}

// Returns if this element is currently visible
function elementIsVisible(element) {
  return element.clientWidth !== 0 && element.clientHeight !== 0
}

// Clamp number between two values with the following line:
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// Setup a pressed key map
var pressedKeys = {}
window.addEventListener('keydown', function(e) { pressedKeys[e.code] = true })
window.addEventListener('keyup',   function(e) { pressedKeys[e.code] = false })

///////// AngleSlider

const DEG = Math.PI / 180.0 

function wrap(v, minV, maxV) {
  return minV + v - Math.floor((v - minV) / (maxV - minV)) * (maxV - minV)
}

class AngleSlider {
  constructor(id, valueTextId, minValue, maxValue, stepSize, leftKey, rightKey, fineStepSize=null) {
    this.angle = 0
    this.minValue = minValue
    this.maxValue = maxValue
    this.stepSize = stepSize
    this.fineStepSize = fineStepSize || stepSize / 2
    this.canvas = el(id)
    this.valueTextElement = el(valueTextId)
    this.centerX = this.canvas.width / 2
    this.centerY = this.canvas.height / 2
    this.arrowSize = this.canvas.height / 3.0
    this.userInteractionEnabled = true
    this.draw()

    let self = this

    function onclick(e) {
      if (!self.userInteractionEnabled) {
        return
      }

      if (e.buttons > 0) {
        self.angle = Math.PI - Math.atan2(e.layerX - self.centerX, e.layerY - self.centerY)
        self.valueTextElement.innerHTML = self.value.toFixed(0)
        self.draw()

        if (self.onValueChanged) {
          self.onValueChanged(self.angle)
        }
      }
    }

    this.canvas.onclick = onclick
    this.canvas.onmousemove = onclick

    // Hotkeys
    self.leftKey = leftKey
    self.rightKey = rightKey

    document.addEventListener('keydown', function(e) {
      if (!self.userInteractionEnabled) {
        return
      }

      let delta = pressedKeys['ShiftLeft'] ? self.fineStepSize : self.stepSize

      switch(e.code) {
        case self.leftKey:
          self.value -= delta
          break;
        case self.rightKey:
          self.value += delta
      }
    });
  }

  get value() {
    return this.angle / DEG
  }

  set value(degrees) {
    let d = wrap(degrees, this.minValue, this.maxValue)
    this.angle = d * DEG
    this.valueTextElement.innerHTML = (this.angle / DEG).toFixed(0)
    this.draw()

    if (this.onValueChanged) {
      this.onValueChanged(this.angle)
    }
  }

  draw() {
    let ctx = this.canvas.getContext('2d')
    ctx.save()
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    let centerX = this.canvas.width / 2.0
    let centerY = this.canvas.height / 2.0
    ctx.translate(centerX, centerY)
    ctx.rotate(this.angle)
  
    let width = 12

    // Arrow shaft
    let startX = 0
    let startY = this.arrowSize
    let endX = 0
    let endY = -this.arrowSize
  
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.strokeStyle = "#d3d3d3"
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.stroke()

    // Arrowhead
    ctx.beginPath()
    ctx.moveTo(endX - width, endY + 2 * width)
    ctx.lineTo(endX + width, endY + 2 * width)
    ctx.lineTo(endX, endY)
    ctx.closePath()
    ctx.fillStyle = "#82B366"
    ctx.strokeStyle = "#82B366"
    ctx.lineJoin = 'round'
    ctx.fill()
    ctx.stroke()
  
    ctx.restore()
  }
}


////////// Slider class //////////

vertical = 'vertical'
horizontal = 'horizontal'

class Slider {
  constructor(orientation, name, minValue, maxValue, label, showValue, showCenterButton, sliderClasses="", stepSize=null, decrementKeys=[], incrementKeys=[], fineStepSize=null) {
    let self = this
    this.name = name
    this.minValue = minValue
    this.maxValue = maxValue
    this.orientation = orientation
    this.stepSize = stepSize || (maxValue - minValue) / 10
    this.fineStepSize = fineStepSize || this.stepSize / 2
    this.decrementKeys = decrementKeys
    this.incrementKeys = incrementKeys
    console.log(name + "SliderContainer");
    let parentElement = el(name + "SliderContainer")

    if (orientation == vertical) {
      let centerButtonHTML = showCenterButton ? `<button class="sliderCenter" id="` + name + `Center">🎯</button>` : ``
      let valueHTML = showValue ? `<div class="sliderName">` + label + `</div><div class="sliderValue" id="` + name + `Value"></div>` : ``

      parentElement.innerHTML = `
        <div style="display: flex; flex-direction: row; align-items: center;">
          <div style="display: flex; flex-direction: column; width:80pt; align-items: center;">` + valueHTML + centerButtonHTML + 
          `</div>

          <div class="verticalSliderOuterContainer">
            <div class="value">` + maxValue + `</div>
            <div class="verticalSliderInnerContainer">
              <input type="range" min="` + minValue + `" max="` + maxValue + `" value="0" class="slider vertical ` + sliderClasses + `" id="` + name + `Slider">
            </div>
            <div class="value">` + minValue + `</div>
          </div>
        </div>
      `
    }
    else {
      let centerButtonHTML = showCenterButton ? `<button class="sliderCenter" id="` + name + `Center">🎯</button>` : ``
      let valueHTML = showValue ? `<div class="sliderTop"><div class="sliderName">` + label + `</div><div class="sliderValue" id="` + name + `Value">0</div></div>` : ``

      parentElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center;">`
        + centerButtonHTML + valueHTML + `
        <div>
          <div class="value">` + minValue + `</div>
          <input type="range" min="` + minValue + `" max="`+ maxValue + `" value="0" class="slider ` + sliderClasses + `" id="` + name + `Slider">
          <div class="value">` + maxValue + `</div>
        </div>
      </div>
      `
    }

    this.sliderElement = el(this.name + 'Slider')
    this.valueElement = el(this.name + 'Value')

    this.sliderElement.oninput = function() {
      self.valueElement.innerHTML = self.sliderElement.value
    }

    if (decrementKeys.length > 0) {
      document.addEventListener('keydown', function (e) {
        if (elementIsVisible(self.sliderElement)) {
          for (let keyCode of self.decrementKeys) {
            if (!pressedKeys[keyCode] && e.code != keyCode) {
              return
            }
          }
          if (pressedKeys[FINE_CONTROL_KEY]) {
            self.value -= self.fineStepSize
          }
          else {
            self.value -= self.stepSize
          }
        }
      })
    }

    if (incrementKeys.length > 0) {
      document.addEventListener('keydown', function (e) {
        if (elementIsVisible(self.sliderElement)) {
          for (let keyCode of self.incrementKeys) {
            if (!pressedKeys[keyCode] && e.code != keyCode) {
              return
            }
          }
          if (pressedKeys[FINE_CONTROL_KEY]) {
            self.value += self.fineStepSize
          }
          else {
            self.value += self.stepSize
          }
        }
      })
    }

    this.valueElement.innerHTML = this.sliderElement.value

  }

  get value() {
    return Number(this.sliderElement.value)
  }

  set value(v) {
    v = clamp(v, this.minValue, this.maxValue)
    this.sliderElement.value = v
    this.valueElement.innerHTML = v
  }

  decrement() {
    this.value -= this.stepSize
  }

  increment() {
    this.value += this.stepSize
  }
}

/////////// TabbedSections class

class TabbedSection {
  constructor(buttonId, sectionId) {
    this.button = el(buttonId)
    this.section = el(sectionId)
  }
}

class TabbedSections {
  constructor(tabbedSections, activeIndex) {
    this.tabbedSections = tabbedSections
    this.activeIndex = Number(activeIndex) || Number(0)
    let self = this

    // Add event listeners to all the buttons
    for (let i in self.tabbedSections) {
      let tabbedSection = tabbedSections[i]

      tabbedSection.button.onclick = function(e) {
        for (let j in self.tabbedSections) {
          let otherTabbedSection = self.tabbedSections[j]

          if (i == j) {
            otherTabbedSection.section.classList.remove("hidden")
          }
          else {
            otherTabbedSection.section.classList.add("hidden")
          }
        }
        self.activeIndex = Number(i)
      }
    }

    this.tabbedSections[this.activeIndex].button.onclick()
  }

  set activeIndex(v) {
    this._activeIndex = v
  }

  get activeIndex() {
    return this._activeIndex
  }
}


/////////// Throttle and Speed Section //////////

diveTabbedSections = new TabbedSections([new TabbedSection("diveManualButton", "diveManualSection"), new TabbedSection("divePIDButton", "divePIDSection")], 0)
throttleTabbedSections = new TabbedSections([new TabbedSection("throttleManualButton", "throttleSection"), new TabbedSection("throttlePIDButton", "speedSection")], 0)
rudderTabbedSections = new TabbedSections([new TabbedSection("rudderManualButton", "rudderSection"), new TabbedSection("rudderPIDButton", "headingSection")], 0)
//elevatorsTabbedSections = new TabbedSections([new TabbedSection("elevatorsManualButton", "elevatorsSection"), new TabbedSection("elevatorsPIDButton", "rollSection")], 0)

////////

diveManualSlider = new Slider(vertical, "diveManual", 0, 100, "Dive Throttle", true, false, "dive", stepSize=2, decrementKeys=["KeyG"], incrementKeys=["KeyT"])
divePIDSlider =    new Slider(vertical, "divePID",    0, 100, "Dive Depth",    true, false, "dive", stepSize=2, decrementKeys=["KeyG"], incrementKeys=["KeyT"])

throttleSlider = new Slider(vertical, "throttle", 0, 100, "Throttle", true, false, "throttle", 10, decrementKeys=[DEAD_MANS_SWITCH_KEY, "KeyS"], incrementKeys=[DEAD_MANS_SWITCH_KEY, "KeyW"], fineStepSize=5)
speedSlider = new Slider(vertical, "speed", 0, 15, "Speed", true, false, "throttle", 2, decrementKeys=[DEAD_MANS_SWITCH_KEY, "KeyS"], incrementKeys=[DEAD_MANS_SWITCH_KEY, "KeyW"], fineStepSize=1)

rudderSlider = new Slider(horizontal, "rudder", -100, 100, "Rudder", true, true,
                          "", 10, [ 'KeyA' ], [ 'KeyD' ])
headingSlider = new AngleSlider('headingWidget', 'headingValue', 0, 360, 10, 'KeyA', 'KeyD', fineStepSize=5)
headingSlider.onValueChanged = function(angle) {
  angle_deg = angle / DEG
  sector = Math.floor((angle_deg + 22.5) / 45) % 8
  dirs = [ "N", "NE", "E", "SE", "S", "SW", "W", "NW" ]

  cardinal = el("headingDirectionField")
  cardinal.innerHTML = dirs[sector]
}

//portElevatorSlider = new Slider(vertical, "portElevator", -100, 100, "Port Elevator", true, true, "elevator", 10, ['KeyJ'], ['KeyU'])
//stbdElevatorSlider = new Slider(vertical, "stbdElevator", -100, 100, "Stbd Elevator", true, true, "elevator", 10, ['KeyL'], ['KeyO'])
//rollSlider = new Slider(horizontal, "roll", -180, 180, "Roll", true, false, "", 10, ['KeyQ'], ['KeyE'])
//pitchSlider = new Slider(horizontal, "pitch", -90, 90, "Pitch", true, false, "elevator", 10, ['KeyK'], ['KeyI'])

timeoutSlider = new Slider(horizontal, "timeout", 0, 120, "Timeout", false, false, "timeout", stepSize=5, decrementKeys=["KeyV"], incrementKeys=["KeyB"], fineStepSize=1)
timeoutSlider.value = 5

/////////// PIDGains form class //////////

class PIDGains {
  constructor(name, api_name) {
    this.name = name
    this.api_name = api_name

    let parentElement = el(name + "Gains")
    parentElement.innerHTML = `
      <div class="gains">
        <div class="gainRow">
          <div class="gainLabel">Kp</div>
          <input class="gain" type="text" id="` +
                              name + `_Kp" name="fname" value="1"><br/>
        </div>
        <div class="gainRow">
          <div class="gainLabel">Ki</div>
          <input class="gain" type="text" id="` +
                              name + `_Ki" name="fname" value="0"><br/>
        </div>
        <div class="gainRow">
          <div class="gainLabel">Kd</div>
          <input class="gain" type="text" id="` +
                              name + `_Kd" name="fname" value="0"><br/>
        </div>
        <button class="submit" type="button" id="` +
                              name +
                              `_submit">Submit</button>
      </div>
    `

    this.KpElement = el(name + '_Kp') 
    this.KiElement = el(name + '_Ki') 
    this.KdElement = el(name + '_Kd') 
    this.submitElement = el(name + '_submit')
    let self = this

               this.submitElement.onclick = function() {
      let pid_control = {timeout : 1}

      pid_control[self.api_name] = {
        Kp : self.KpElement.value,
        Ki : self.KiElement.value,
        Kd : self.KdElement.value
      }

      let engineering_command = {
        botId : getSelectedBotId(),
        pid_control : pid_control
      }

      sendCommand(engineering_command)
    }
  }

  get Kp() {
    return this.KpElement.value
  }

  get Ki() {
    return this.KiElement.value
  }

  get Kd() {
    return this.KdElement.value
  }

}

diveGains = new PIDGains('divePID', 'depth')
speedGains = new PIDGains('speed', 'speed')
headingGains = new PIDGains('heading', 'heading')
//rollGains = new PIDGains('roll', 'roll')
//pitchGains = new PIDGains('pitch', 'pitch')

//////// Dive Button 

function diveButtonOnClick() {
    var engineering_command = getVisibleCommand()
    var pid_control = engineering_command.pid_control
    pid_control.timeout = timeoutSlider.value
  
    // Stop sending commands until
    blockSendingUntil = Date.now() + pid_control.timeout * 1000

    let isSendCommand = false;

    if(diveManualSlider.value <= SAFE_BOT_SPEED)
    {
      isSendCommand = true;
    }
    else if(confirm("Are you sure you'd like to run above the safe speed level for the bot? (This may result in hardware failure)"))
    {
      isSendCommand = true;
    }

    if(isSendCommand)
    {
      switch (diveTabbedSections.activeIndex) {
        case 0: // Manual
          pid_control.throttle = -diveManualSlider.value
          break;
        case 1: // PID
          delete pid_control.throttle
          pid_control.depth = {
            target : divePIDSlider.value,
            Kp : diveGains.Kp,
            Ki : diveGains.Ki,
            Kd : diveGains.Kd
          };
          break;
      }
      sendCommand(engineering_command)
    }
    else
    {
      console.log("Did not send command")
    }
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

///////

function selectSection(selectedSection, unselectedSection) {
  el(selectedSection + "Section").classList.remove("unselected")
  el(selectedSection + "Section").classList.add("selected")

  el(unselectedSection + "Section").classList.add("unselected")
  el(unselectedSection + "Section").classList.remove("selected")
}

////////// Dead man's switch / throttle lock ////////

class DeadMansSwitch {
  static #on = false

  static setOn(_on) {
    DeadMansSwitch.on = _on
    el("deadMansSwitch").style.backgroundColor = _on ? "green" : "red"

    el('throttleSlider').disabled = !_on
    el('speedSlider').disabled = !_on

    if (!_on) {
      throttleSlider.value = 0
      speedSlider.value = 0
    }
  }
}

window.onblur = function() {
  DeadMansSwitch.setOn(false)
}

DeadMansSwitch.setOn(false)

////////// LED code //////////
let LEDSwitchON = false

function LEDButtonOnClick(e) {
  LEDSwitchON = true
  return
}

function LEDButtoffOnClick(e) {
  LEDSwitchON = false
  return
}

////////// Setup hotkeys /////////

function keyDown(e) {
  if (e.code == DEAD_MANS_SWITCH_KEY) {
    DeadMansSwitch.setOn(true)
    return
  }
  else {
    handleKey(e.code)
  }
}

function keyUp(e) {
  if (e.code == DEAD_MANS_SWITCH_KEY) {
    DeadMansSwitch.setOn(false)
    return
  }
}

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp)

function handleKey(key) {
  //let elevatorsDelta = pressedKeys[FINE_CONTROL_KEY] ? portElevatorSlider.fineStepSize : portElevatorSlider.stepSize

  switch (key) {
    case 'KeyZ':
      throttleSlider.value = 0
      speedSlider.value = 0
      rudderSlider.value = 0
      headingSlider.value = 0
      //portElevatorSlider.value = 0
      //stbdElevatorSlider.value = 0
      rollSlider.value = 0
      break;
    case 'KeyC':
      rudderSlider.value = rudderCenter
      //portElevatorSlider.value = portCenter
      //stbdElevatorSlider.value = stbdCenter
      break;
    case 'KeyI':
      /*witch (elevatorsTabbedSections.activeIndex) {
        case 0:
          let delta = Math.min(elevatorsDelta, portElevatorSlider.maxValue - portElevatorSlider.value, stbdElevatorSlider.maxValue - stbdElevatorSlider.value)
          portElevatorSlider.value += delta
          stbdElevatorSlider.value += delta
          break;
        };*/
      break;
    case 'KeyK':
      /*switch (elevatorsTabbedSections.activeIndex) {
        case 0:
          let delta = Math.min(elevatorsDelta, portElevatorSlider.value - portElevatorSlider.minValue, stbdElevatorSlider.value - stbdElevatorSlider.minValue)
          portElevatorSlider.value -= delta
          stbdElevatorSlider.value -= delta
          break;
        };*/
      break;
    case 'KeyQ':
      /*switch (elevatorsTabbedSections.activeIndex) {
        case 0:
          let delta = Math.min(elevatorsDelta, portElevatorSlider.value - portElevatorSlider.minValue, stbdElevatorSlider.maxValue - stbdElevatorSlider.value)
          portElevatorSlider.value -= delta
          stbdElevatorSlider.value += delta
          break;
        };*/
      break;
    case 'KeyE':
      /*switch (elevatorsTabbedSections.activeIndex) {
        case 0:
          let delta = Math.min(elevatorsDelta, portElevatorSlider.maxValue - portElevatorSlider.value, stbdElevatorSlider.value - stbdElevatorSlider.minValue)
          portElevatorSlider.value += delta
          stbdElevatorSlider.value -= delta
          break;
        };*/
      break;
  }
}

////////// Setup Centers /////////

rudderCenter = localStorage.getItem("rudderCenter") || 0.0
el("rudderSlider").value = rudderCenter
el("rudderValue").innerHTML = rudderCenter

/*portCenter = localStorage.getItem("portCenter") || 0.0
el("portElevatorSlider").value = portCenter
el("portElevatorValue").innerHTML = portCenter

stbdCenter = localStorage.getItem("stbdCenter") || 0.0
el("stbdElevatorSlider").value = stbdCenter
el("stbdElevatorValue").innerHTML = stbdCenter*/

el("rudderCenter").onclick =
  function(e) {
    rudderCenter = Number(el("rudderSlider").value)
    localStorage.setItem("rudderCenter", rudderCenter)
  }

/*el("portElevatorCenter").onclick =
  function(e) {
    portCenter = Number(el("portElevatorSlider").value)
    localStorage.setItem("portCenter", portCenter)
  }

el("stbdElevatorCenter").onclick =
  function(e) {
    stbdCenter = Number(el("stbdElevatorSlider").value)
    localStorage.setItem("stbdCenter", stbdCenter)
  }*/

////////// Command Sender //////////////

blockSendingUntil = 0

function getVisibleCommand() {

  let pid_control = {
    timeout: timeoutSlider.value
  }

  if (DeadMansSwitch.on) {

    // Throttle
    switch(throttleTabbedSections.activeIndex) {
      case 0:   
        if(el("throttleSlider").value > SAFE_BOT_SPEED)
        {
          warningStatusInner = "<label style='color:red; display: inline-block; font-size:24pt'>You are running above the safe speed level for the bot? (This may result in hardware failure)</label>"
        }
        else
        {
          warningStatusInner = ""
        }
        pid_control.throttle = el("throttleSlider").value
        delete pid_control.speed
        break;
      case 1:
        delete pid_control.throttle
        pid_control.speed = {
          target : el("speedSlider").value,
          Kp : el("speed_Kp").value,
          Ki : el("speed_Ki").value,
          Kd : el("speed_Kd").value
        };
        break;
    }
  }
  else {
    // Man is dead!  Send zero throttle...
    pid_control.throttle = 0
    delete pid_control.speed
    warningStatusInner = "";
  }
  
  // Rudder
  switch (rudderTabbedSections.activeIndex) {
    case 0:
      pid_control.rudder = el("rudderSlider").value
      delete pid_control.heading
      break;
    case 1:
      delete pid_control.rudder
      pid_control.heading = {
        target : headingSlider.value,
        Kp : el("heading_Kp").value,
        Ki : el("heading_Ki").value,
        Kd : el("heading_Kd").value
      };
      break;
  }
  
  // Elevators
  /*switch (elevatorsTabbedSections.activeIndex) {
    case 0:
      pid_control.portElevator = el("portElevatorSlider").value
      pid_control.stbdElevator = el("stbdElevatorSlider").value
      delete pid_control.roll
      break;
    case 1:
      delete pid_control.portElevator
      delete pid_control.stbdElevator
      pid_control.roll = {
        target : el("rollSlider").value,
        Kp : el("roll_Kp").value,
        Ki : el("roll_Ki").value,
        Kd : el("roll_Kd").value
      };
      pid_control.pitch = {
        target : el("pitchSlider").value,
        Kp : el("pitch_Kp").value,
        Ki : el("pitch_Ki").value,
        Kd : el("pitch_Kd").value
      };
      break;
  }*/

  pid_control.led_switch_on = LEDSwitchON

  let engineering_command = {
    botId : getSelectedBotId(),
    pid_control : pid_control
  }

  return engineering_command
}

function sendVisibleCommand() {
  let now = Date.now()
  if (now < blockSendingUntil) {
    return
  }

  let command = getVisibleCommand()
  sendCommand(command)

  // Get vehicle status
  
  fetch('/jaia/status', {headers: headers})
  .then((response) => response.json())
  .then((response) => {
    updateStatus(response)
  })
  .catch((e) => {
    console.error(e)
    el("statusTable").innerHTML = "Connection error: " + e
  })

}

const interval = setInterval(sendVisibleCommand, 100);

var hub_location = null
var oldControllingClientId = ''

// Updates the status element with a status response object
function updateStatus(status) {

  ///// Is this client in control?
  inControl = (status.controllingClientId == clientId) || status.controllingClientId == null

  document.getElementById('takeControlButton').style.display = inControl ? 'none' : 'inline'

  const controlClass = inControl ? 'controlling' : 'noncontrolling'
  document.getElementById('body').setAttribute('class', controlClass)

  //////

  bots = status["bots"]
  hubs = status["hubs"]

  // For now we just handle one hub
  hub = hubs[0];

  updateBotSelectDropdown(bots)

  table = el("statusTable")
  innerHTML =
      "<tr><th>Bot ID</th><th>Mission State</th><th>Latitude (°)</th><th>Longitude (°)</th><th>Distance (m)</th><th>Depth (m)</th><th>Ground Speed (m/s)</th><th>Course Over Ground (°)</th><th>Heading (°)</th><th>Pitch (°)</th><th>Roll (°)</th><th>Temperature (℃)</th><th>Salinity (PSU(ppt))</th><th>Vcc Voltage (V)</th><th>Vcc Current (A)</th><th>5V Current (A)</th><th>Status Age (s)</th><th>Command Age (s)</th></tr>"
  loggingStatusInnerUp =
      "<label style='color:black; display: inline-block;'>Bots: "
  loggingStatusInnerDown =
      "<label style='color:red; display: inline-block;'>Bots: "
  loggingStatusInner = ""
  isLogging = false
  isNotLogging = false

  let now_us = Date.now() * 1e3

  for (const [botId, bot] of Object.entries(bots)) {
    console.log(bot)

    loggingStatus = el("loggingStatus")

    // Alert user that data is not being logged
    if (bot.missionState == "PRE_DEPLOYMENT__IDLE" ||
        bot.missionState == "POST_DEPLOYMENT__IDLE") {
      loggingStatusInnerDown += bot.bot_id + ", "
      isNotLogging = true;
    }
    else {
      loggingStatusInnerUp += bot.bot_id + ", "
      isLogging = true;
    }

    innerHTML += "<tr>"
    innerHTML += "<td>" + bot.bot_id + "</td>"

    innerHTML += "<td>" + bot.mission_state + "</td>"

    let bot_location = bot.location || null
    let hub_location = hub?.location || null
    innerHTML += "<td>" + (bot.location?.lat?.toFixed(6) || "❌") + "</td>"
    innerHTML += "<td>" + (bot.location?.lon?.toFixed(6) || "❌") + "</td>"

    d = latlon_distance(bot_location, hub_location)
    innerHTML += "<td>" + d?.toFixed(1) || "?" + "</td>"

    innerHTML += "<td>" + (bot.depth?.toFixed(1) || "?") + "</td>"

    innerHTML += "<td>" + (bot.speed?.over_ground?.toFixed(1) || "?") + "</td>"
    innerHTML +=
        "<td>" + (bot.attitude?.course_over_ground?.toFixed(1) || "?") + "</td>"
    innerHTML += "<td>" + (bot.attitude?.heading?.toFixed(1) || "?") + "</td>"
    innerHTML += "<td>" + (bot.attitude?.pitch?.toFixed(1) || "?") + "</td>"
    innerHTML += "<td>" + (bot.attitude?.roll?.toFixed(1) || "?") + "</td>"

    innerHTML += "<td>" + (bot.temperature?.toFixed(1) || "?") + "</td>"

    innerHTML += "<td>" + (bot.salinity?.toFixed(1) || "?") + "</td>"

    innerHTML += "<td>" + (bot.vcc_voltage?.toFixed(1) || "?") + "</td>"
    innerHTML += "<td>" + (bot.vcc_current?.toFixed(1) || "?") + "</td>"
    innerHTML += "<td>" + (bot.vv_current?.toFixed(1) || "?") + "</td>"

    innerHTML +=
        "<td>" + Math.max(0.0, bot.portalStatusAge / 1e6).toFixed(0) + "</td>"

    lastCommandTime = bot.last_command_time
                          ? ((now_us - bot.last_command_time) / 1e6).toFixed(0)
                          : ""
    innerHTML += "<td>" + lastCommandTime + "</td>"

    innerHTML += "</tr>"
  }
  loggingStatusInnerUp += "Logging Status: Logging</label>"
  loggingStatusInnerDown +=
      "Logging Status: Not Logging (Activate For Logging)</label>"

  if (isNotLogging && isLogging) {
    loggingStatusInner = loggingStatusInnerDown + "<br>" + loggingStatusInnerUp
  }
  else if (isNotLogging && !isLogging) {
    loggingStatusInner = loggingStatusInnerDown
  }
  else {loggingStatusInner = loggingStatusInnerUp}

  loggingStatus.innerHTML = loggingStatusInner;
  table.innerHTML = innerHTML
  warningStatus = el("warningStatus")
  warningStatus.innerHTML = warningStatusInner;
}

function getSelectedBotId() { return $("#botSelect")[0].value || "0" }

function updateBotSelectDropdown(bots) {
  let selectElement = $("#botSelect")[0];
  let existingBotIds = $("select#botSelect")
                           .find('option')
                           .toArray()
                           .map(element => element.value)
  let newBotIds = Object.keys(bots)

  // Only change menu if it's different
  if (newBotIds.length == existingBotIds.length) {
    var same = true
    for (let i = 0; i < newBotIds.length; i++) {
      if (newBotIds[i] != existingBotIds[i]) {
        same = false
        break;
      }
    }
  }

  if (same) {
    return
  }

  // Clear select options
  while (selectElement.firstChild) {
    selectElement.removeChild(selectElement.firstChild)
  }

  // Rebuild the options
  for (let botId in bots) {
    let optionElement = document.createElement('option')
    optionElement.setAttribute('value', botId)
    let textNode = document.createTextNode(botId)
    optionElement.appendChild(textNode)

    selectElement.appendChild(optionElement)
  }
}

// Calculate xyz position of lat/lon point
function xyz(pt) {
  deg = 3.14159265358 / 180.0
  r_e = 6.3781e6
  return [ r_e * Math.cos(pt.lon * deg) * Math.sin(pt.lat * deg), 
           r_e * Math.sin(pt.lon * deg) * Math.sin(pt.lat * deg),
           r_e * Math.cos(pt.lat * deg)]
}


// Calculate Euclidean distance
function distance(x, y) {
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2)
}


// Calculate distance between two lat/lon points
function latlon_distance(pt1, pt2) {
  if (!pt1 || !pt2) {
    return undefined
  }

  xyz1 = xyz(pt1)
  xyz2 = xyz(pt2)
  return distance(xyz1, xyz2)
}

function helpButtonOnClick(e) {
  let pane = el('helpPane')
  let classList = pane.classList
  if (classList.contains('hidden')) {
    classList.remove('hidden')

    // Put it in the center of the display
    style = window.getComputedStyle(pane, null)
    x = (document.body.clientWidth  - parseInt(style.width, 10)) / 2.0
    y = (document.body.clientHeight - parseInt(style.height, 10)) / 2.0
    pane.style.left = x + 'px'
    pane.style.top = y + 'px'
  }
  else {
    classList.add('hidden')
  }
}

function onMouseDownDeadMansSwitch(evt) {
  DeadMansSwitch.setOn(true)
}

function onMouseUpDeadMansSwitch(evt) {
  DeadMansSwitch.setOn(false)
}

function takeControl(evt) {
  fetch('/jaia/takeControl', {method: 'POST', headers: {clientId: clientId}})
  .then((response) => response.json())
}

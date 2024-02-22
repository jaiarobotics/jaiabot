import { api, JaiaAPI } from './api.js'
import { deadMansSwitch } from './deadMansSwitch.js'
import { updateStatus } from './updateStatus.js'
import { botDropdown } from './BotDropdown.js'
import { calibrationApp } from './calibration.js'
import { echoApp } from './echo.js'

let FINE_CONTROL_KEY = "ShiftRight"
let DEAD_MANS_SWITCH_KEY = "ShiftLeft"
let warningStatusInner = ""
//****** Changing the SAFE_BOT_SPEED may result in bot hardware failure   ****** 
//****** Please do not increase the SAFE_BOT_SPEED unless you know the  ****** 
//****** consequences                                                     ******
let SAFE_BOT_SPEED = 60;

// Gets an element with this id
function el(id) {
  const element = document.getElementById(id)
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

const vertical = 'vertical'
const horizontal = 'horizontal'

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

const diveTabbedSections = new TabbedSections(
    [
      new TabbedSection("diveManualButton", "diveManualSection"),
      new TabbedSection("divePIDButton", "divePIDSection")
    ],
    0)
const throttleTabbedSections = new TabbedSections(
    [
      new TabbedSection("throttleManualButton", "throttleSection"),
      new TabbedSection("throttlePIDButton", "speedSection")
    ],
    0)
const rudderTabbedSections = new TabbedSections(
    [
      new TabbedSection("rudderManualButton", "rudderSection"),
      new TabbedSection("rudderPIDButton", "headingSection")
    ],
    0)
//elevatorsTabbedSections = new TabbedSections([new TabbedSection("elevatorsManualButton", "elevatorsSection"), new TabbedSection("elevatorsPIDButton", "rollSection")], 0)

////////

const diveManualSlider =
    new Slider(vertical, "diveManual", 0, 100, "Dive Throttle", true, false,
               "dive", 2, [ "KeyG" ], [ "KeyT" ])
const divePIDSlider = new Slider(vertical, "divePID", 0, 100, "Dive Depth",
                                 true, false, "dive", 2, [ "KeyG" ], [ "KeyT" ])

const throttleSlider = new Slider(
    vertical, "throttle", 0, 100, "Throttle", true, false, "throttle", 10,
    [ DEAD_MANS_SWITCH_KEY, "KeyS" ], [ DEAD_MANS_SWITCH_KEY, "KeyW" ], 5)
const speedSlider = new Slider(vertical, "speed", 0, 15, "Speed", true, false,
                               "throttle", 2, [ DEAD_MANS_SWITCH_KEY, "KeyS" ],
                               [ DEAD_MANS_SWITCH_KEY, "KeyW" ], 1)

const rudderSlider = new Slider(horizontal, "rudder", -100, 100, "Rudder", true,
                                true, "", 10, [ 'KeyA' ], [ 'KeyD' ])
const headingSlider = new AngleSlider('headingWidget', 'headingValue', 0, 360,
                                      10, 'KeyA', 'KeyD', 5)

headingSlider.onValueChanged =
    function(angle) {
  angle_deg = angle / DEG
  sector = Math.floor((angle_deg + 22.5) / 45) % 8
  dirs = [ "N", "NE", "E", "SE", "S", "SW", "W", "NW" ]

  cardinal = el("headingDirectionField")
  cardinal.innerHTML = dirs[sector]
}

// portElevatorSlider = new Slider(vertical, "portElevator", -100, 100, "Port
// Elevator", true, true, "elevator", 10, ['KeyJ'], ['KeyU']) stbdElevatorSlider
// = new Slider(vertical, "stbdElevator", -100, 100, "Stbd Elevator", true, true,
// "elevator", 10, ['KeyL'], ['KeyO']) rollSlider = new Slider(horizontal,
// "roll", -180, 180, "Roll", true, false, "", 10, ['KeyQ'], ['KeyE'])
// pitchSlider = new Slider(horizontal, "pitch", -90, 90, "Pitch", true, false,
// "elevator", 10, ['KeyK'], ['KeyI'])

const timeoutSlider =
    new Slider(horizontal, "timeout", 0, 120, "Timeout", false, false,
               "timeout", 5, [ "KeyV" ], [ "KeyB" ], 1)
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

      api.sendEngineeringCommand(engineering_command, true)
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

const diveGains = new PIDGains('divePID', 'depth')
const speedGains = new PIDGains('speed', 'speed')
const headingGains = new PIDGains('heading', 'heading')
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
      api.sendEngineeringCommand(engineering_command, true)
    }
    else
    {
      console.log("Did not send command")
    }
}

el('diveButton').addEventListener('click', diveButtonOnClick)

///////

function selectSection(selectedSection, unselectedSection) {
  el(selectedSection + "Section").classList.remove("unselected")
  el(selectedSection + "Section").classList.add("selected")

  el(unselectedSection + "Section").classList.add("unselected")
  el(unselectedSection + "Section").classList.remove("selected")
}

////////// LED code //////////
let LEDSwitchON = false

function LEDButtonOnClick(e) {
  LEDSwitchON = true
  return
}

document.getElementById('LEDOnButton')
    .addEventListener('click', LEDButtonOnClick)

function LEDButtonOffClick(e) {
  LEDSwitchON = false
  return
}

document.getElementById('LEDOffButton')
    .addEventListener('click', LEDButtonOffClick)

////////// Setup hotkeys /////////

function keyDown(e) {
  if (e.code == DEAD_MANS_SWITCH_KEY) {
    deadMansSwitch.setOn(true)
    return
  }
  else {
    handleKey(e.code)
  }
}

function keyUp(e) {
  if (e.code == DEAD_MANS_SWITCH_KEY) {
    deadMansSwitch.setOn(false)
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

      /*switch (elevatorsTabbedSections.activeIndex) {
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

var rudderCenter = localStorage.getItem("rudderCenter") || 0.0
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

var blockSendingUntil = 0

function getVisibleCommand() {

  let pid_control = {
    timeout: timeoutSlider.value
  }

  if (deadMansSwitch.on) {

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
  api.sendEngineeringCommand(command)

  // Get vehicle status
  
  api.getStatus()
  .then((status) => {
    updateStatus(status)
    botDropdown.updateWithBots(status.bots)
    calibrationApp.updateStatus(status)
    echoApp.updateStatus(status)
  })
  .catch((e) => {
    console.error(e)
    el("statusTable").innerHTML = "Connection error: " + e
  })

}

// 1 second plus 10 milliseconds, to avoid dropping a lot of engineering commands due to rounding errors
const interval = setInterval(sendVisibleCommand, 1010);

var hub_location = null
var oldControllingClientId = ''

function getSelectedBotId() {
  return document.getElementById("botSelect")?.value || "0"
}

function updateBotSelectDropdown(bots) {
  let selectElement = document.getElementById("botSelect");
  let existingBotIds = Array
                           .from(document.getElementById("botSelect")
                                     .getElementsByTagName('option'))
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
  const r_e = 6.3781e6
  return [
    r_e * Math.cos(pt.lon * DEG) * Math.sin(pt.lat * DEG),
    r_e * Math.sin(pt.lon * DEG) * Math.sin(pt.lat * DEG),
    r_e * Math.cos(pt.lat * DEG)
  ]
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

  const xyz1 = xyz(pt1)
  const xyz2 = xyz(pt2)
  return distance(xyz1, xyz2)
}

// Event handlers exposed to html
export function helpButtonOnClick(e) {
  let pane = el('helpPane')
  let classList = pane.classList
  if (classList.contains('hidden')) {
    classList.remove('hidden')

    // Put it in the center of the display
    const style = window.getComputedStyle(pane, null)
    const x = (document.body.clientWidth - parseInt(style.width, 10)) / 2.0
    const y = (document.body.clientHeight - parseInt(style.height, 10)) / 2.0
    pane.style.left = x + 'px'
    pane.style.top = y + 'px'
  }
  else {
    classList.add('hidden')
  }
}

document.getElementById('helpOpenButton')
    .addEventListener('click', helpButtonOnClick)
document.getElementById('helpCloseButton')
    .addEventListener('click', helpButtonOnClick)

document.getElementById('take-control')
    .addEventListener('click', () => {
      api.takeControl()
    })

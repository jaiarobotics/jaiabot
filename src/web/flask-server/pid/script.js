// Gets an element with this id
function el(id) {
  return document.getElementById(id)
}

// Clamp number between two values with the following line:
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

///////// AngleSlider

const DEG = Math.PI / 180.0 

function wrap(v, minV, maxV) {
  return minV + v - Math.floor((v - minV) / (maxV - minV)) * (maxV - minV)
}

class AngleSlider {
  constructor(id, valueTextId, minValue, maxValue, delta, leftKey, rightKey) {
    this.angle = 0
    this.minValue = minValue
    this.maxValue = maxValue
    this.delta = delta
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

      switch(e.code) {
        case self.leftKey:
          self.value -= self.delta
          break
        case self.rightKey:
          self.value += self.delta
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
  constructor(orientation, name, minValue, maxValue, label, showValue, showCenterButton, sliderClasses="") {
    this.name = name
    this.minValue = minValue
    this.maxValue = maxValue
    this.stepSize = (maxValue - minValue) / 10
    this.orientation = orientation

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

throttleTabbedSections = new TabbedSections([new TabbedSection("throttleManualButton", "throttleSection"), new TabbedSection("throttlePIDButton", "speedSection")], 0)
rudderTabbedSections = new TabbedSections([new TabbedSection("rudderManualButton", "rudderSection"), new TabbedSection("rudderPIDButton", "headingSection")], 0)
elevatorsTabbedSections = new TabbedSections([new TabbedSection("elevatorsManualButton", "elevatorsSection"), new TabbedSection("elevatorsPIDButton", "rollSection")], 0)

////////

throttleSlider = new Slider(vertical, "throttle", 0, 100, "Throttle", true, false, "throttle")
speedSlider = new Slider(vertical, "speed", 0, 15, "Speed", true, false, "throttle")

rudderSlider = new Slider(horizontal, "rudder", -100, 100, "Rudder", true, true)
headingSlider = new AngleSlider('headingWidget', 'headingValue', 0, 360, 10, 'KeyA', 'KeyD')
headingSlider.onValueChanged = function(angle) {
  angle_deg = angle / DEG
  sector = Math.floor((angle_deg + 22.5) / 45) % 8
  dirs = [ "N", "NE", "E", "SE", "S", "SW", "W", "NW" ]

  cardinal = el("headingDirectionField")
  cardinal.innerHTML = dirs[sector]
}

portElevatorSlider = new Slider(vertical, "portElevator", -100, 100, "Port Elevator", true, true, "elevator")
stbdElevatorSlider = new Slider(vertical, "stbdElevator", -100, 100, "Stbd Elevator", true, true, "elevator")
rollSlider = new Slider(horizontal, "roll", -180, 180, "Roll", true, false, "elevator")

diveSlider = new Slider(horizontal, "dive", 0, 100, "Dive", false, false)

/////////// PIDGains form class //////////

class PIDGains {
  constructor(name) {
    this.name = name

    let parentElement = el(name + "Gains")
    parentElement.innerHTML = `
      <div class="gains">
        <div class="gainRow">
          <div class="gainLabel">Kp</div>
          <input class="gain" type="text" id="` + name + `_Kp" name="fname" value="1"><br/>
        </div>
        <div class="gainRow">
          <div class="gainLabel">Ki</div>
          <input class="gain" type="text" id="` + name + `_Ki" name="fname" value="0"><br/>
        </div>
        <div class="gainRow">
          <div class="gainLabel">Kd</div>
          <input class="gain" type="text" id="` + name + `_Kd" name="fname" value="0"><br/>
        </div>
        <button class="submit" type="button" id="` + name + `_submit">Submit</button>
      </div>
    `
  }
}

speedGains = new PIDGains('speed')
headingGains = new PIDGains('heading')
rollGains = new PIDGains('roll')

//////// Dive Button 

function diveButtonOnClick() {
  sendDiveCommand(diveSlider.value)
}

function sendCommand(command) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/jaia/command", true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(command));
}

function sendDiveCommand(diveThrottle) {
  let command = getVisibleCommand()
  
  // Timeout
  command.timeout = el("timeout").value
  command.throttle = -diveThrottle

  blockSendingUntil = Date.now() + command.timeout * 1000

  sendCommand(command)
}

///////

function selectSection(selectedSection, unselectedSection) {
  el(selectedSection + "Section").classList.remove("unselected")
  el(selectedSection + "Section").classList.add("selected")

  el(unselectedSection + "Section").classList.add("unselected")
  el(unselectedSection + "Section").classList.remove("selected")
}


function setupOther(id) {
  el(id).onclick = function() {
    resetSliders()
    sendVisibleCommand()
  }
}

function setupSlider(name) {
  let slider = el(name + "Slider")
  let value = el(name + "Value")
  value.innerHTML = slider.value
  
  slider.oninput = function() {
    value.innerHTML = slider.value
    sendVisibleCommand()
  }
}

////////// Dead man's switch / throttle lock ////////

class DeadMansSwitch {
  static #on = false

  static setOn(_on) {
    DeadMansSwitch.on = _on
    el("deadMansSwitch").textContent = _on ? "🟢" : "❌"

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

////////// Setup hotkeys /////////

function keyDown(e) {
  if (e.code == 'ShiftLeft' || e.code == 'ShiftRight') {
    DeadMansSwitch.setOn(true)
    return
  }
  else {
    handleKey(e.code)
  }
}

function keyUp(e) {
  if (e.code == 'ShiftLeft' || e.code == 'ShiftRight') {
    DeadMansSwitch.setOn(false)
    return
  }
}

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp)

function handleKey(key) {
  switch (key) {
    case 'KeyZ':
      throttleSlider.value = 0
      speedSlider.value = 0
      rudderSlider.value = 0
      headingSlider.value = 0
      portElevatorSlider.value = 0
      stbdElevatorSlider.value = 0
      rollSlider.value = 0
      break
    case 'KeyC':
      throttleSlider.value = 0
      speedSlider.value = 0
      rudderSlider.value = rudderCenter
      headingSlider.value = 0
      portElevatorSlider.value = portCenter
      stbdElevatorSlider.value = stbdCenter
      rollSlider.value = 0
      break
    case 'KeyS':
      if (DeadMansSwitch.on) {
        let slider = throttleTabbedSections.activeIndex == 0 ? throttleSlider : speedSlider
        slider.decrement()
      }
      break
    case 'KeyW':
      if (DeadMansSwitch.on) {
        let slider = throttleTabbedSections.activeIndex == 0 ? throttleSlider : speedSlider
        slider.increment()
      }
      break
    case 'KeyA':
      if (rudderTabbedSections.activeIndex == 0) {
        rudderSlider.decrement()
      }
      break
    case 'KeyD':
      if (rudderTabbedSections.activeIndex == 0) {
        rudderSlider.increment()
      }
      break
    case 'CapsLock':
      portElevatorSlider.decrement()
      break
    case 'Tab':
      portElevatorSlider.increment()
      break
    case 'KeyG':
      stbdElevatorSlider.decrement()
      break
    case 'KeyT':
      stbdElevatorSlider.increment()
      break
    case 'KeyQ':
      switch (elevatorsTabbedSections.activeIndex) {
        case 0:
          portElevatorSlider.decrement()
          stbdElevatorSlider.increment()
          break
        case 1:
          rollSlider.decrement()
          break
      }
      break
    case 'KeyE':
      switch (elevatorsTabbedSections.activeIndex) {
        case 0:
          portElevatorSlider.increment()
          stbdElevatorSlider.decrement()
          break
        case 1:
          rollSlider.increment()
          break
      }
      break
  }
}

////////// Setup Centers /////////

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

rudderCenter = getCookie("rudderCenter") || 0.0
el("rudderSlider").value = rudderCenter

portCenter   = getCookie("portCenter") || 0.0
el("portElevatorSlider").value = portCenter

stbdCenter   = getCookie("stbdCenter") || 0.0
el("stbdElevatorSlider").value = stbdCenter

function setCookie(cname, cvalue) {
  document.cookie = cname + "=" + cvalue + ";";
}

el("rudderCenter").onclick = function(e) {
  rudderCenter = Number(el("rudderSlider").value)
  setCookie("rudderCenter", rudderCenter)
}

el("portElevatorCenter").onclick = function(e) {
  portCenter = Number(el("portElevatorSlider").value)
  setCookie("portCenter", portCenter)
}

el("stbdElevatorCenter").onclick = function(e) {
  stbdCenter = Number(el("stbdElevatorSlider").value)
  setCookie("stbdCenter", stbdCenter)
}

////////// Throttle //////////////

setupSlider("throttle")

////////// Speed //////////////

setupSlider("speed")
setupOther("speed_submit")

////////// Rudder //////////////

setupSlider("rudder")

////////// Heading //////////////

setupOther("heading_submit")

////////// Elevators //////////////

setupSlider("portElevator")
setupSlider("stbdElevator")

////////// Heading //////////////

setupSlider("roll")
setupOther("roll_submit")

////////// Command Sender //////////////

blockSendingUntil = 0

function getVisibleCommand() {
  let command = {}

  // Timeout
  command.timeout = el("timeout").value
  
  if (DeadMansSwitch.on) {

    // Throttle
    switch(throttleTabbedSections.activeIndex) {
      case 0:
        command.throttle = el("throttleSlider").value
        delete command.speed
        break
      case 1:
        delete command.throttle
        command.speed = {
          target: el("speedSlider").value,
          Kp: el("speed_Kp").value,
          Ki: el("speed_Ki").value,
          Kd: el("speed_Kd").value
        }
        break
    }
  }
  else {
    // Man is dead!  Send zero throttle...
    command.throttle = 0
    delete command.speed
  }
  
  // Rudder
  switch (rudderTabbedSections.activeIndex) {
    case 0:
      command.rudder = el("rudderSlider").value
      delete command.heading
      break
    case 1:
      delete command.rudder
      command.heading = {
        target: headingSlider.value,
        Kp: el("heading_Kp").value,
        Ki: el("heading_Ki").value,
        Kd: el("heading_Kd").value
      }
      break
  }
  
  // Elevators
  switch (elevatorsTabbedSections.activeIndex) {
    case 0:
      command.portElevator = el("portElevatorSlider").value
      command.stbdElevator = el("stbdElevatorSlider").value
      delete command.roll
      break
    case 1:
      delete command.portElevator
      delete command.stbdElevator
      command.roll = {
        target: el("rollSlider").value,
        Kp: el("roll_Kp").value,
        Ki: el("roll_Ki").value,
        Kd: el("roll_Kd").value
      }
      break
  }

  return command
}

function sendVisibleCommand() {
  let now = Date.now()
  if (now < blockSendingUntil) {
    return
  }

  let command = getVisibleCommand()
  sendCommand(command)
    
  // Get vehicle status
  
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/jaia/getStatus", true);
  xhr.onload = function (e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        updateStatus(JSON.parse(xhr.responseText))
      } else {
        console.error(xhr.statusText);
        el("statusTable").innerHTML = "Connection error: " + xhr.status + xhr.statusText
      }
    }
  };
  xhr.onerror = function (e) {
    console.error(xhr.statusText);
    el("statusTable").innerHTML = "Connection error: " + xhr.status + xhr.statusText
  };
  xhr.send(null);
}

const interval = setInterval(sendVisibleCommand, 1000);

var hub_location = null

// Updates the status element with a status response object
function updateStatus(status) {
  bots = status["bots"]
  table = el("statusTable")
  innerHTML = "<tr><th>Bot ID</th><th>Latitude</th><th>Longitude</th><th>Distance</th><th>Speed</th><th>Heading</th><th>Time to ACK</th>"
  
  for (bot of bots) {
    if (bot["botID"] == 255) {
      var hub = bot
      hub_location = hub.location
    }

    innerHTML += "<tr>"
    innerHTML += "<td>" + bot.botID + "</td>"

    bot_location = bot["location"]
    innerHTML += "<td>" + bot_location.lat.toFixed(6) + "</td>"
    innerHTML += "<td>" + bot_location.lon.toFixed(6) + "</td>"

    if (hub_location) {
      d = latlon_distance(bot_location, hub_location)
      innerHTML += "<td>" + d.toFixed(1) + "</td>"
    }
    else {
      innerHTML += "<td>?</td>"
    }

    innerHTML += "<td>" + bot.velocity.toFixed(1) + "</td>"
    innerHTML += "<td>" + bot.heading.toFixed(1) + "</td>"
    innerHTML += "<td>" + (bot.time.time_to_ack / 1e6).toFixed(2) + "</td>"
    innerHTML += "</tr>"

  }

  table.innerHTML = innerHTML

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
  xyz1 = xyz(pt1)
  xyz2 = xyz(pt2)
  return distance(xyz1, xyz2)
}


// Gets an element with this id
function el(id) {
  return document.getElementById(id)
}

////////// Slider class //////////

class VerticalSlider {
  constructor(name, minValue, maxValue, label) {
    this.name = name
    this.minValue = minValue
    this.maxValue = maxValue

    let parentElement = el(name + "Container")
    parentElement.innerHTML = `
      <div style="display: flex; flex-direction: row; align-items: center;">
        <div style="display: flex; flex-direction: column; width:80pt; align-items: center;">
          <div class="sliderName">` + label + `</div><div class="sliderValue" id="` + name + `Value"></div>
        </div>

        <div class="verticalSliderContainer">
          <div class="value">` + maxValue + `</div>
          <div class="verticalSliderInnerContainer">
            <input type="range" min="` + minValue + `" max="` + maxValue + `" value="0" class="slider vertical" id="` + name + `Slider">
          </div>
          <div class="value">` + minValue + `</div>
        </div>
      </div>
    `
  }
}

////////

throttleSlider = new VerticalSlider("throttle", 0, 100, "Throttle")
speedSlider = new VerticalSlider("speed", 0, 15, "Speed")
portElevatorSlider = new VerticalSlider("portElevator", -100, 100, "Port Elevator")
stbdElevatorSlider = new VerticalSlider("stbdElevator", -100, 100, "Stbd Elevator")

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
          <input class="gain" type="text" id="` + name + `_Ki" name="fname" value="1"><br/>
        </div>
        <div class="gainRow">
          <div class="gainLabel">Kd</div>
          <input class="gain" type="text" id="` + name + `_Kd" name="fname" value="1"><br/>
        </div>
        <button class="submit" type="button" id="` + name + `_submit">Submit</button>
      </div>
    `
  }
}

speedGains = new PIDGains('speed')
headingGains = new PIDGains('heading')
rollGains = new PIDGains('roll')

////////

function selectSection(selectedSection, unselectedSection) {
  el(selectedSection + "Section").classList.remove("unselected")
  el(selectedSection + "Section").classList.add("selected")

  el(unselectedSection + "Section").classList.add("unselected")
  el(unselectedSection + "Section").classList.remove("selected")
}

function resetSliders() {
    // Reset unused sliders
    if (el("throttleRadioButton").checked) {
      setSlider("speed", 0)
      selectSection("throttle", "speed")
    }
    else {
      setSlider("throttle", 0)
      selectSection("speed", "throttle")
    }

    if (el("rudderRadioButton").checked) {
      selectSection("rudder", "heading")
      setSlider("heading", 0)
    }
    else {
      selectSection("heading", "rudder")
      setSlider("rudder", rudderCenter)
    }

    if (el("elevatorsRadioButton").checked) {
      selectSection("elevators", "roll")
      setSlider("roll", 0)
    }
    else {
      selectSection("roll", "elevators")
      setSlider("portElevator", portCenter)
      setSlider("stbdElevator", stbdCenter)
    }
}

resetSliders()

function setupOther(id) {
  el(id).onclick = function() {
    resetSliders()
    sendCommand()
  }
}

function setupSlider(name) {
  let slider = el(name + "Slider")
  let value = el(name + "Value")
  console.log(value)
  value.innerHTML = slider.value
  
  slider.oninput = function() {
    value.innerHTML = slider.value
    sendCommand()
  }
}

function changeSlider(name, amount) {
  let slider = el(name + "Slider")
  let value = el(name + "Value")
  slider.value = Number(slider.value) + amount
  value.innerHTML = slider.value
}

function setSlider(name, v) {
  let slider = el(name + "Slider")
  let value = el(name + "Value")
  slider.value = v
  value.innerHTML = slider.value
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
      setSlider('throttle', 0)
      setSlider('speed', 0)
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
  let dx = 10

  switch (key) {
    case 'KeyC':
      setSlider('throttle', 0)
      setSlider('speed', 0)
      setSlider('rudder', rudderCenter)
      setSlider('heading', 0)
      setSlider('portElevator', portCenter)
      setSlider('stbdElevator', stbdCenter)
      setSlider('roll', 0)
    break
    case 'KeyS':
      if (DeadMansSwitch.on) {
        section = el('throttleRadioButton').checked ? 'throttle' : 'speed'
        changeSlider(section, -dx)
      }
      break
    case 'KeyW':
      if (DeadMansSwitch.on) {
        section = el('throttleRadioButton').checked ? 'throttle' : 'speed'
        changeSlider(section, dx)
      }
      break
    case 'KeyA':
      section = el('rudderRadioButton').checked ? 'rudder' : 'heading'
      changeSlider(section, -dx)
      break
    case 'KeyD':
      section = el('rudderRadioButton').checked ? 'rudder' : 'heading'
      changeSlider(section, dx)
      break
    case 'KeyF':
      changeSlider('portElevator', -dx)
      break
    case 'KeyR':
      changeSlider('portElevator', dx)
      break
    case 'KeyG':
      changeSlider('stbdElevator', -dx)
      break
    case 'KeyT':
      changeSlider('stbdElevator', dx)
      break
    case 'KeyQ':
      if (el('elevatorsRadioButton').checked) {
        changeSlider('portElevator', -dx)
        changeSlider('stbdElevator', dx)
      }
      else {
        changeSlider('roll', -dx)
      }
      break
    case 'KeyE':
      if (el('elevatorsRadioButton').checked) {
        changeSlider('portElevator', dx)
        changeSlider('stbdElevator', -dx)
      }
      else {
        changeSlider('roll', dx)
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

el("portCenter").onclick = function(e) {
  portCenter = Number(el("portElevatorSlider").value)
  setCookie("portCenter", portCenter)
}

el("stbdCenter").onclick = function(e) {
  stbdCenter = Number(el("stbdElevatorSlider").value)
  setCookie("stbdCenter", stbdCenter)
}

////////// Throttle //////////////

setupOther("throttleRadioButton")
setupSlider("throttle")

////////// Speed //////////////

setupSlider("speed")
setupOther("speed_submit")
setupOther("speedRadioButton")

////////// Rudder //////////////

setupSlider("rudder")
setupOther("rudderRadioButton")

////////// Heading //////////////

setupSlider("heading")
setupOther("heading_submit")
setupOther("headingRadioButton")

////////// Elevators //////////////

setupSlider("portElevator")
setupSlider("stbdElevator")
setupOther("elevatorsRadioButton")

////////// Heading //////////////

setupSlider("roll")
setupOther("roll_submit")
setupOther("rollRadioButton")

////////// Browser location ////////////

// Get our location

my_location = { "lat": 0.0, "lon": 0.0 }

navigator.geolocation.getCurrentPosition(function(position) {
  my_location.lat = position.coords.latitude
  my_location.lon = position.coords.longitude
})

////////// Command Sender //////////////

function sendCommand() {
  command = {}
  
  // Timeout
  command.timeout = el("timeout").value
  
  if (DeadMansSwitch.on) {

    // Throttle
    if (el("throttleRadioButton").checked) {
    
      command.throttle = el("throttleSlider").value
    
    }
  
    // Speed
    if (el("speedRadioButton").checked) {
  
      command.speed = {
        target: el("speedSlider").value,
        Kp: el("speed_Kp").value,
        Ki: el("speed_Ki").value,
        Kd: el("speed_Kd").value
      }
      
    }
  
  }
  else {
    // Man is dead!  Send zero throttle...
    command.throttle = 0
  }
  
  // Rudder
  if (el("rudderRadioButton").checked) {
  
    command.rudder = el("rudderSlider").value
  
  }

  // Heading
  if (el("headingRadioButton").checked) {

    command.heading = {
      target: el("headingSlider").value,
      Kp: el("heading_Kp").value,
      Ki: el("heading_Ki").value,
      Kd: el("heading_Kd").value
    }
    
  }
  
  // Elevators
  if (el("elevatorsRadioButton").checked) {
  
    command.portElevator = el("portElevatorSlider").value
    command.stbdElevator = el("stbdElevatorSlider").value
  
  }

  // Roll
  if (el("rollRadioButton").checked) {

    command.roll = {
      target: el("rollSlider").value,
      Kp: el("roll_Kp").value,
      Ki: el("roll_Ki").value,
      Kd: el("roll_Kd").value
    }
    
  }
  
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/jaia/command", true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(command));
    
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

const interval = setInterval(sendCommand, 1000);

var hub_location = null

// Updates the status element with a status response object
function updateStatus(status) {
  bots = status["bots"]
  table = el("statusTable")
  innerHTML = "<tr><th>Bot ID</th><th>Latitude</th><th>Longitude</th><th>Distance</th><th>Speed</th><th>Heading</th><th>Time to ACK</th>"
  
  console.log(hub_location)

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

    //   el("latitude").innerHTML = bot_location["lat"]
    //   el("longitude").innerHTML = bot_location["lon"]
      
    // el("distance").innerHTML = latlon_distance(bot_location, my_location)  
      
    // el("speed").innerHTML = bot["velocity"]
    // el("heading").innerHTML = bot["heading"]
    // el("time_to_ack").innerHTML = bot["time"]["time_to_ack"] / 1e6
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


var commandChanged = false

// Gets an element with this id
function el(id) {
  return document.getElementById(id)
}

function setupOther(id) {
  el(id).onclick = function() {
    commandChanged = true
  }
}

function setupSlider(name) {
  let slider = el(name + "Slider")
  let value = el(name + "Value")
  value.innerHTML = slider.value
  
  slider.oninput = function() {
    value.innerHTML = slider.value
    commandChanged = true
  }
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

////////// Command Sender //////////////

const interval = setInterval(function() {
  if (commandChanged) {
  
    command = {}
    
    console.log(el("throttleRadioButton"))
    console.log(el("speedRadioButton"))
    
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
    
    commandChanged = false
  }
}, 2000);


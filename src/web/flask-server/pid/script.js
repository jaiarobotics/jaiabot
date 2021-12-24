var commandChanged = false

// Gets an element with this id
function el(id) {
  return document.getElementById(id)
}

////////// Throttle //////////////

var throttleSlider = el("throttleSlider")
var throttleValue = el("throttleValue")
var throttleRadioButton = el("throttleRadioButton")
throttleValue.innerHTML = throttleSlider.value // Display the default slider value

throttleRadioButton.onclick = function() {
  commandChanged = true
}

throttleSlider.oninput = function() {
  throttleValue.innerHTML = throttleSlider.value
  commandChanged = true
}

////////// Speed //////////////

var speedSlider = document.getElementById("speedSlider")
var speedValue = document.getElementById("speedValue")
speedValue.innerHTML = speedSlider.value // Display the default slider value

speedSlider.oninput = function() {
  speedValue.innerHTML = speedSlider.value
  commandChanged = true
}

el("speed_submit").onclick = function() {
  commandChanged = true
}

el("speedRadioButton").onclick = function() {
  commandChanged = true
}

////////// Rudder //////////////

var rudderSlider = el("rudderSlider")
var rudderValue = el("rudderValue")
var rudderRadioButton = el("rudderRadioButton")
rudderValue.innerHTML = rudderSlider.value // Display the default slider value

rudderRadioButton.onclick = function() {
  commandChanged = true
}

rudderSlider.oninput = function() {
  rudderValue.innerHTML = rudderSlider.value
  commandChanged = true
}

////////// Heading //////////////

var headingSlider = document.getElementById("headingSlider")
var headingValue = document.getElementById("headingValue")
headingValue.innerHTML = headingSlider.value // Display the default slider value

headingSlider.oninput = function() {
  headingValue.innerHTML = headingSlider.value
  commandChanged = true
}

el("heading_submit").onclick = function() {
  commandChanged = true
}

el("headingRadioButton").onclick = function() {
  commandChanged = true
}

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
    
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/jaia/command", true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(command));
    
    commandChanged = false
  }
}, 2000);


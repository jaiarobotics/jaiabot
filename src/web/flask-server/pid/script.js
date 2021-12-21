var commandChanged = false

function el(id) {
  return document.getElementById(id)
}

var rudderSlider = document.getElementById("rudderSlider")
var rudderValue = document.getElementById("rudderValue")
rudderValue.innerHTML = rudderSlider.value // Display the default slider value

// Update the current slider value (each time you drag the slider handle)
rudderSlider.oninput = function() {
  rudderValue.innerHTML = rudderSlider.value
}

var headingSlider = document.getElementById("headingSlider")
var headingValue = document.getElementById("headingValue")
headingValue.innerHTML = headingSlider.value // Display the default slider value

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Update the current slider value (each time you drag the slider handle)
headingSlider.oninput = function() {
  headingValue.innerHTML = headingSlider.value
  commandChanged = true
}

el("heading_submit").onclick = function() {
  commandChanged = true
}


// Command sender

const interval = setInterval(function() {
  if (commandChanged) {
  
    command = {
      heading: {
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


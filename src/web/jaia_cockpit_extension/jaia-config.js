const software_group = document.getElementById("sg");
const su_output = document.getElementById("su_output");
const ss_output = document.getElementById("ss_output");
const sg_output = document.getElementById("sg_output");
const ss_result = document.getElementById("ss_result");
const sg_result = document.getElementById("sg_result");
const su_result = document.getElementById("su_result");
const get_ss = document.getElementById("get_ss");
const set_sg = document.getElementById("set_sg");
const get_su = document.getElementById("get_su");

/*
Software update
*/
function software_update_run() {
  /* global cockpit */
  console.log("software_update_run");
  cockpit.spawn([ "jaiabot-update-packages.sh" ])
      .stream(software_update_output)
      .then(software_update_success)
      .catch(software_update_fail);

  su_result.innerHTML = "";
  su_output.innerHTML = "";
}

function software_update_success() {
  su_result.style.color = "green";
  su_result.innerHTML = "success";
}

function software_update_fail() {
  su_result.style.color = "red";
  su_result.innerHTML = "fail";
}

function software_update_output(data) {
  su_output.append(document.createTextNode(data));
}

// Connect the button to starting the "software update" process
get_su.addEventListener("click", software_update_run);

/*
Software status
*/
function software_status_run() {
  /* global cockpit */
  console.log("software_status_run");
  cockpit.spawn([ "jaiabot-version-status.sh" ])
      .stream(software_status_output)
      .then(software_status_success)
      .catch(software_status_fail);

  ss_result.innerHTML = "";
  ss_output.innerHTML = "";
}

function software_status_success() {
  ss_result.style.color = "green";
  ss_result.innerHTML = "success";
}

function software_status_fail() {
  ss_result.style.color = "red";
  ss_result.innerHTML = "fail";
}

function software_status_output(data) {
  ss_output.append(document.createTextNode(data));
}

// Connect the button to starting the "software status" process
get_ss.addEventListener("click", software_status_run);

/*
Software group
*/
function software_group_run() {
  /* global cockpit */
  console.log("software_group_run");
  console.log(software_group.value);
  cockpit.spawn([ "jaiabot-software-group.sh", software_group.value ])
      .stream(software_group_output)
      .then(software_group_success)
      .catch(software_group_fail);

  sg_result.innerHTML = "";
}

function software_group_success() {
  sg_result.style.color = "green";
  sg_result.innerHTML = "success";
}

function software_group_fail() {
  sg_result.style.color = "red";
  sg_result.innerHTML = "fail";
}

function software_group_output(data) {
  sg_output.append(document.createTextNode(data));
}

// Connect the button to starting the "software group" process
set_sg.addEventListener("click", software_group_run);

// Send a 'init' message.  This tells integration tests that we are ready to go
cockpit.transport.wait(function() {});

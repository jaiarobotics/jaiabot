#include <SPI.h>
#include <pb_decode.h>
#include <pb_encode.h>
#include <Servo.h>
#include <stdio.h>
//#include <Adafruit_MAX31855.h>

#ifdef UENUM
#undef UENUM
#endif
#include "jaiabot/messages/nanopb/arduino.pb.h"
#include "crc16.h"

// Indicates the code version
// If you are increasing this version than update
// arduino driver configuration to include the new
// version
const int arduino_version = 2;

// Binary serial protocol
// [JAIA][2-byte size - big endian][bytes][JAIA]...
// TODO: Add CRC32?

// A compile time evaluated pointer to a constant character.
constexpr const char* SERIAL_MAGIC = "JAIA";
constexpr int SERIAL_MAGIC_BYTES = 4;
constexpr int SIZE_BYTES = 2;
using serial_size_type = uint16_t;

using crc_type = uint16_t;

constexpr int BITS_IN_BYTE = 8;
static_assert(jaiabot_protobuf_ArduinoCommand_size < (1ul << (SIZE_BYTES*BITS_IN_BYTE)), "ArduinoCommand is too large, must fit in SIZE_BYTES word");

Servo rudder_servo, port_elevator_servo, stbd_elevator_servo, motor_servo;

constexpr int STBD_ELEVATOR_PIN = 6;
constexpr int RUDDER_PIN = 5;
constexpr int PORT_ELEVATOR_PIN = 9;
constexpr int MOTOR_PIN = 3;

// The timeout
unsigned long t_last_command = 0;
int32_t command_timeout = -1; 
void handle_timeout();
void halt_all();

// Neutral values for timing out
constexpr int motor_neutral = 1500;
constexpr int stbd_elevator_neutral = 1500;
constexpr int port_elevator_neutral = 1500;
constexpr int rudder_neutral = 1500;

// Elevators
int target_stbd_elevator = 1500;
int target_port_elevator = 1500;

// Rudder
int target_rudder = 1500;

// Motor
int motor_tracked = 1500;
int motor_target = 1500;
int motor_actual = 1500;

// Motor Bounds
int motor_min_forward = 1600;
int motor_min_reverse = 1400;

int motor_max_forward = 1900;
int motor_max_reverse = 1100;

// Motor Steps
constexpr int motor_max_step_forward_faster = 12;
constexpr int motor_max_step_forward_slower = 12;
constexpr int motor_max_step_reverse_faster = 12;
constexpr int motor_max_step_reverse_slower = 12;

// The thermocouple
//constexpr int CLOCK_PIN = 7;
//constexpr int SELECT_PIN = 4;
//constexpr int DATA_PIN = A4;

bool thermocouple_is_present = false;

//Adafruit_MAX31855 thermocouple(CLOCK_PIN, SELECT_PIN, DATA_PIN);

// Power Pins
constexpr int POWER_PIN = A1;
constexpr int CTRL_ACTS = 10;
constexpr int FAULT_ACTS = 8;

// LED A5 is also D19
constexpr int LED_D1_PIN = A5;
bool target_led_switch_on = false;

// Voltage and Current
constexpr int VvCurrent = A3;
constexpr int VccCurrent = A2;
constexpr int VccVoltage = A0;
constexpr int thermistor_pin = A4;

jaiabot_protobuf_ArduinoCommand command = jaiabot_protobuf_ArduinoCommand_init_default;

double Vcccurrent_rolling_average() {

  //for rolling average
  const int capacity = 25;

  static int amps[capacity]{0};
  static int rewrite = 0;
  static int fullness = 0;

  const double arduino_units = 0.0049;
  const double half_volt = .5;
  const double amp_volt_conversion = 10;

  amps[rewrite] = (analogRead(VccCurrent));
  fullness = max(rewrite + 1, fullness);

  rewrite = (rewrite + 1) % capacity;

  double vcccurrent = 0;
  for (int j = 0; j < fullness; j++){
    vcccurrent += amps[j];
  }
  vcccurrent = vcccurrent / fullness;

  return ((vcccurrent * arduino_units) - half_volt) * 10;

}


// Send a response message back to the RasPi
void send_ack(jaiabot_protobuf_ArduinoStatusCode code, uint32_t crc=0, uint32_t calculated_crc=0)
{
  const size_t max_ack_size = 256;

  bool status = true;
  uint8_t pb_binary_data[max_ack_size] = {0};
  serial_size_type message_length = 0;

  pb_ostream_t stream = pb_ostream_from_buffer(pb_binary_data, sizeof(pb_binary_data));

  // Copy code and message
  jaiabot_protobuf_ArduinoResponse ack = jaiabot_protobuf_ArduinoResponse_init_default;
  ack.crc = crc;
  ack.has_crc = true;
  ack.calculated_crc = calculated_crc;
  ack.has_calculated_crc = true;

  ack.status_code = code;

  if (thermocouple_is_present) {
    // Get the thermocouple temperature
    //ack.thermocouple_temperature_C = thermocouple.readCelsius();
    ack.has_thermocouple_temperature_C = true;
  }
  else {
    ack.has_thermocouple_temperature_C = false;
  }

  ack.vccvoltage = analogRead(VccVoltage)*.0306;
  ack.has_vccvoltage = true;
  ack.vvcurrent = ((analogRead(VvCurrent)*.0049)-5)*-.05;
  ack.has_vvcurrent = true;

  // Vcccurrent
  ack.vcccurrent = Vcccurrent_rolling_average();
  ack.has_vcccurrent = true;

  // Arduino Version
  ack.version = arduino_version;

  // Current motor value
  ack.has_motor = true;
  ack.motor = motor_actual;

  ack.has_thermistor_voltage = true;
  // Arduino yields resolution between readings of 5V over 1024 units
  ack.thermistor_voltage = analogRead(thermistor_pin) * 5 / 1024.0;

  status = pb_encode(&stream, jaiabot_protobuf_ArduinoResponse_fields, &ack);
  message_length = stream.bytes_written;

  if (status)
  {
    Serial.write(SERIAL_MAGIC, SERIAL_MAGIC_BYTES);
    Serial.write((message_length >> BITS_IN_BYTE) & 0xFF);
    Serial.write(message_length & 0xFF);
    Serial.write(pb_binary_data, message_length);
  }
  delay(10);
}

void setup()
{
  // Make sure the power pin isn't in the off mode
  digitalWrite(POWER_PIN, LOW);

  // Enable power to actuators. In the future, we can durn off based on FAULT_ACTS
  pinMode(CTRL_ACTS, OUTPUT);
  digitalWrite(CTRL_ACTS, LOW);

  pinMode(FAULT_ACTS, INPUT);

  Serial.begin(115200);
  while (!Serial) {
    delay(1);
  }

  delay(100);

  pinMode(VccCurrent, INPUT);
  pinMode(VccVoltage, INPUT);
  pinMode(VvCurrent, INPUT);
  pinMode(LED_D1_PIN, OUTPUT);
  
  motor_servo.attach(MOTOR_PIN);
  rudder_servo.attach(RUDDER_PIN);
  stbd_elevator_servo.attach(STBD_ELEVATOR_PIN);
  port_elevator_servo.attach(PORT_ELEVATOR_PIN);

  // Begin thermocouple, but abandon after 5 second
  /*for (int i = 0; i < 500; i++) {
    if (thermocouple.begin()) {
      thermocouple_is_present = true;
      break;
    }
    delay(10);
  }*/

  init_crc16_tab();

  // Send startup code
  send_ack(jaiabot_protobuf_ArduinoStatusCode_STARTUP);
}


int32_t clamp(int32_t v, int32_t min, int32_t max) {
  if (v == motor_neutral) return motor_neutral;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

int32_t motor_forward_clamp(int32_t v, int32_t forward_start) {
  if (v == motor_neutral) return motor_neutral;
  if (v < forward_start) return forward_start;
  return v;
}

int32_t motor_reverse_clamp(int32_t v, int32_t reverse_start) {
  if (v == motor_neutral) return motor_neutral;
  if (v > reverse_start) return reverse_start;
  return v;
}

void writeToActuators()
{
  // If we want to go forward faster
  if (motor_target > motor_neutral && motor_target > motor_tracked)
  {
      motor_tracked += min(motor_target - motor_tracked, motor_max_step_forward_faster);
      motor_actual = motor_forward_clamp(motor_tracked, motor_min_forward);
  }
  // If we want to go forward slower (including stopping)
  else if (motor_target > motor_neutral && motor_target < motor_tracked ||
            motor_target == motor_neutral && motor_tracked > motor_neutral)
  {
      motor_tracked -= min(motor_tracked - motor_target, motor_max_step_forward_slower);
      motor_actual = motor_forward_clamp(motor_tracked, motor_min_forward);
  }
  // If we are going reverse and we are trying to go slower
  else if (motor_target < motor_neutral && motor_target > motor_tracked ||
            motor_target == motor_neutral && motor_tracked < motor_neutral)
  {
      motor_tracked += min(motor_target - motor_tracked, motor_max_step_reverse_slower);
      motor_actual = motor_reverse_clamp(motor_tracked, motor_min_reverse);
  }
  // If we are going reverse and we are trying to go faster
  else if (motor_target < motor_neutral && motor_target < motor_tracked)
  {
      motor_tracked -= min(motor_tracked - motor_target, motor_max_step_reverse_faster);
      motor_actual = motor_reverse_clamp(motor_tracked, motor_min_reverse);
  }

  motor_servo.writeMicroseconds(motor_actual);
  rudder_servo.writeMicroseconds(target_rudder);
  stbd_elevator_servo.writeMicroseconds(target_stbd_elevator);
  port_elevator_servo.writeMicroseconds(target_port_elevator);

  if (target_led_switch_on == true){
    analogWrite(LED_D1_PIN, 255);
  }
  else if (target_led_switch_on == false){
    analogWrite(LED_D1_PIN, 0);
  }
}


void loop()
{
  // Run loop at 16Hz
  delay(63); 

  // Write to Motor, rudder, and elevators
  writeToActuators();

  constexpr int prefix_size = SERIAL_MAGIC_BYTES + SIZE_BYTES;

  handle_timeout();

  // Command received at 10Hz
  while (Serial.available() >= prefix_size) {
    handle_timeout();

    // read bytes until the next magic word start (hopefully)
    while (Serial.available() > 0  && Serial.peek() != SERIAL_MAGIC[0]) {
      handle_timeout();
      Serial.read();
    }

    // Get prefix
    uint8_t prefix[prefix_size] = {0};
    if (Serial.readBytes(prefix, prefix_size) != prefix_size) {
      send_ack(jaiabot_protobuf_ArduinoStatusCode_PREFIX_READ_ERROR);
      continue;
    }

    // Check magic
    if (memcmp(SERIAL_MAGIC, prefix, SERIAL_MAGIC_BYTES) != 0) {
      send_ack(jaiabot_protobuf_ArduinoStatusCode_MAGIC_WRONG);
      continue;
    }

    // Read the message size
    serial_size_type size = 0;
    size |= prefix[SERIAL_MAGIC_BYTES];
    size << BITS_IN_BYTE;
    size |= prefix[SERIAL_MAGIC_BYTES + 1];

    if (size > jaiabot_protobuf_ArduinoCommand_size) {
      send_ack(jaiabot_protobuf_ArduinoStatusCode_MESSAGE_TOO_BIG);
      continue;
    }

    uint8_t pb_binary_data[jaiabot_protobuf_ArduinoCommand_size] = {0};

    // Read the protobuf binary-encoded message
    if (Serial.readBytes(pb_binary_data, size) != size) {
      send_ack(jaiabot_protobuf_ArduinoStatusCode_MESSAGE_WRONG_SIZE);
      continue;
    }

    // // Read the CRC
    crc_type crc;

    if (Serial.readBytes((char *) &crc, sizeof(crc)) != sizeof(crc)) {
      send_ack(jaiabot_protobuf_ArduinoStatusCode_CRC_ERROR);
      continue;
    }

    // Check the CRC
    crc_type calculated_crc = fletcher16(pb_binary_data, size);

    if (calculated_crc != crc) {
      send_ack(jaiabot_protobuf_ArduinoStatusCode_CRC_ERROR, crc, calculated_crc);
      continue;
    }

    // Decode the protobuf command message
    pb_istream_t stream = pb_istream_from_buffer(pb_binary_data, size);

    bool status = pb_decode(&stream, jaiabot_protobuf_ArduinoCommand_fields, &command);

    if (!status)
    {
      //Send Ack that we failed to decode command
      send_ack(jaiabot_protobuf_ArduinoStatusCode_MESSAGE_DECODE_ERROR);
      continue;
      // send_ack(DEBUG, PB_GET_ERROR(&stream));
    } 

    if(command.has_actuators)
    {
      // The commanded targets
      motor_target = command.actuators.motor;
      target_rudder = command.actuators.rudder;
      target_stbd_elevator = command.actuators.stbd_elevator;
      target_port_elevator = command.actuators.port_elevator;
      target_led_switch_on = command.actuators.led_switch_on; 
      // Set the timeout vars
      t_last_command = millis();
      command_timeout = command.actuators.timeout * 1000;

      // char message[256];
      // sprintf(message, "%ld, %ld, %ld, %ld", command.motor, command.rudder, command.stbd_elevator, command.port_elevator);

      //Send Ack that we successfully received command
      send_ack(jaiabot_protobuf_ArduinoStatusCode_ACK);
    } 
    else if(command.has_settings)
    {
      motor_min_forward = command.settings.forward_start;
      motor_min_reverse = command.settings.reverse_start;
      //Send Ack that we successfully received command
      send_ack(jaiabot_protobuf_ArduinoStatusCode_SETTINGS);
    }
  }

}

void handle_timeout() {
  if (command_timeout < 0) return;
  
  unsigned long now = millis();
  if (now - t_last_command > command_timeout) {
    command_timeout = -1;
    halt_all();

    send_ack(jaiabot_protobuf_ArduinoStatusCode_TIMEOUT);
  }
}

void halt_all() {
  motor_target = motor_neutral;
  target_rudder = rudder_neutral;
  target_stbd_elevator = stbd_elevator_neutral;
  target_port_elevator = port_elevator_neutral;
  target_led_switch_on = false;
}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_ArduinoCommand, jaiabot_protobuf_ArduinoCommand, 2)
PB_BIND(jaiabot_protobuf_ArduinoActuators, jaiabot_protobuf_ArduinoActuators, 2)
PB_BIND(jaiabot_protobuf_ArduinoSettings, jaiabot_protobuf_ArduinoSettings, 2)
PB_BIND(jaiabot_protobuf_ArduinoResponse, jaiabot_protobuf_ArduinoResponse, 2)

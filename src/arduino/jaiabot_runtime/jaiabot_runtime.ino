#include <SPI.h>
#include <pb_decode.h>
#include <pb_encode.h>
#include <Servo.h>
#include <stdio.h>
#include <Adafruit_MAX31855.h>

#ifdef UENUM
#undef UENUM
#endif
#include "jaiabot/messages/nanopb/arduino.pb.h"

// Binary serial protocol
// [JAIA][2-byte size - big endian][bytes][JAIA]...
// TODO: Add CRC32?
constexpr const char* SERIAL_MAGIC = "JAIA";
constexpr int SERIAL_MAGIC_BYTES = 4;
constexpr int SIZE_BYTES = 2;
using serial_size_type = uint16_t;

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
int motor_neutral = 1500;
int stbd_elevator_neutral = 1500;
int port_elevator_neutral = 1500;
int rudder_neutral = 1500;

// The thermocouple
constexpr int CLOCK_PIN = 7;
constexpr int SELECT_PIN = 4;
constexpr int DATA_PIN = A4;

bool thermocouple_is_present = false;

Adafruit_MAX31855 thermocouple(CLOCK_PIN, SELECT_PIN, DATA_PIN);

// Power Pins
constexpr int POWER_PIN = A1;
const int CTRL_ACTS = 10;
const int FAULT_ACTS = 8;

// LED
constexpr int LED_D1_PIN = A5;
const int LED_D2_PIN = A6;

// Voltage and Current
const int VvCurrent = A3;
const int VccCurrent = A2;
const int VccVoltage = A0;

//for rolling average
const int capacity = 50;
int amps[capacity]{0};
int rewrite = 0;
int fullness = 0;
double vcccurrent = 0;
const double arduino_units = 0.0049;
const double half_volt = .5;
const double amp_volt_conversion = 10;


jaiabot_protobuf_ArduinoCommand command = jaiabot_protobuf_ArduinoCommand_init_default;

enum AckCode {
  STARTUP = 0,
  ACK = 1,
  TIMEOUT = 2,
  DEBUG=3
};

char ack_message[256] = {0};

// Callback for encoding the response message, if present
bool write_string(pb_ostream_t *stream, const pb_field_t *field, void * const *arg)
{
    if (!pb_encode_tag_for_field(stream, field))
        return false;

    return pb_encode_string(stream, (uint8_t*)ack_message, strlen(ack_message));
}

// Send a response message back to the RasPi
void send_ack(AckCode code, char message[])
{
  const size_t max_ack_size = 256;

  bool status = true;
  uint8_t pb_binary_data[max_ack_size] = {0};
  serial_size_type message_length = 0;

  pb_ostream_t stream = pb_ostream_from_buffer(pb_binary_data, sizeof(pb_binary_data));

  // Copy code and message
  jaiabot_protobuf_ArduinoResponse ack = jaiabot_protobuf_ArduinoResponse_init_default;
  ack.code = code;

  pb_callback_t callback;
  callback.funcs.encode = write_string;
  callback.arg = NULL;
  ack.message = callback;

  if (thermocouple_is_present) {
    // Get the thermocouple temperature
    ack.thermocouple_temperature_C = thermocouple.readCelsius();
    ack.has_thermocouple_temperature_C = true;
  }
  else {
    ack.has_thermocouple_temperature_C = false;
  }

  ack.vccvoltage = analogRead(VccVoltage)*.0306;
  ack.has_vccvoltage = true;
  ack.vvcurrent = ((analogRead(VvCurrent)*.0049)-5)*-.05;
  ack.has_vvcurrent = true;
  if (rewrite>= capacity){
    rewrite = 0;
  }
  if (fullness < capacity){
    ++fullness;
  }
  amps[rewrite++] = (analogRead(VccCurrent));

  vcccurrent = 0;
  for (int j = 0; j < capacity; ++j){
    vcccurrent += amps[j];
  }
  vcccurrent = vcccurrent/fullness;

  ack.vcccurrent = ((vcccurrent*arduino_units)-half_volt)*10;
  ack.has_vcccurrent = true;

  if (message != NULL) {
    strncpy(ack_message, message, 250);
  }
  else {
    strncpy(ack_message, "", 250);
  }

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
  pinMode(LED_D2_PIN, OUTPUT);
  
  motor_servo.attach(MOTOR_PIN);
  rudder_servo.attach(RUDDER_PIN);
  stbd_elevator_servo.attach(STBD_ELEVATOR_PIN);
  port_elevator_servo.attach(PORT_ELEVATOR_PIN);

  // Begin thermocouple, but abandon after 5 second
  for (int i = 0; i < 500; i++) {
    if (thermocouple.begin()) {
      thermocouple_is_present = true;
      break;
    }
    delay(10);
  }

  // Send startup code
  send_ack(STARTUP, NULL);
}


int32_t clamp(int32_t v, int32_t min, int32_t max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}


void loop()
{

  constexpr int prefix_size = SERIAL_MAGIC_BYTES + SIZE_BYTES;

  handle_timeout();

  while (Serial.available() >= prefix_size) {
    handle_timeout();
    
    // read bytes until the next magic word start (hopefully)
    while (Serial.available() > 0  && Serial.peek() != SERIAL_MAGIC[0]) {
      handle_timeout();
      Serial.read();
    }

    uint8_t prefix[prefix_size] = {0};
    if (Serial.readBytes(prefix, prefix_size) == prefix_size)
    {
      // If the magic is correct
      if (memcmp(SERIAL_MAGIC, prefix, SERIAL_MAGIC_BYTES) == 0)
      {
        // Read the message size
        serial_size_type size = 0;
        size |= prefix[SERIAL_MAGIC_BYTES];
        size << BITS_IN_BYTE;
        size |= prefix[SERIAL_MAGIC_BYTES + 1];

        if (size <= jaiabot_protobuf_ArduinoCommand_size)
        {
          uint8_t pb_binary_data[jaiabot_protobuf_ArduinoCommand_size] = {0};

          // Read the protobuf binary-encoded message
          if (Serial.readBytes(pb_binary_data, size) == size)
          {
            pb_istream_t stream = pb_istream_from_buffer(pb_binary_data, size);

            // Decode the protobuf command message
            bool status = pb_decode(&stream, jaiabot_protobuf_ArduinoCommand_fields, &command);
            if (!status)
            {
              send_ack(DEBUG, "Decoding ArduinoCommand protobuf failed:");
              send_ack(DEBUG, PB_GET_ERROR(&stream));
            }

            motor_servo.writeMicroseconds (command.motor);
            rudder_servo.writeMicroseconds(command.rudder);
            stbd_elevator_servo.writeMicroseconds(command.stbd_elevator);
            port_elevator_servo.writeMicroseconds(command.port_elevator);

            if (command.LEDSwitchON == true){
              analogWrite(LED_D1_PIN, 255);
              analogWrite(LED_D2_PIN, 255);
            }
            else if (command.LEDSwitchON == false){
              analogWrite(LED_D1_PIN, 0);
              analogWrite(LED_D2_PIN, 0);
            }

            // Set the timeout vars
            t_last_command = millis();
            command_timeout = command.timeout * 1000;

            // char message[256];
            // sprintf(message, "%ld, %ld, %ld, %ld", command.motor, command.rudder, command.stbd_elevator, command.port_elevator);
            send_ack(ACK, NULL);
          }
          else
          {
            send_ack(DEBUG, "Read wrong number of bytes for PB data");
          }
        }
        else
        {
          send_ack(DEBUG, "Message size is wrong (too big)");
        }

      }
      else
      {
        send_ack(DEBUG, "Serial magic is wrong");
      }
    }
    else
    {
      send_ack(DEBUG, "Read wrong number of bytes for prefix");
    }
  }

}

void handle_timeout() {
  if (command_timeout < 0) return;
  
  unsigned long now = millis();
  if (now - t_last_command > command_timeout) {
    command_timeout = -1;
    halt_all();

    send_ack(TIMEOUT, NULL);
  }
}

void halt_all() {
  const int motor_off = motor_neutral;
  const int rudder_off = rudder_neutral;
  const int stbd_elevator_off = stbd_elevator_neutral;
  const int port_elevator_off = port_elevator_neutral;
}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_ArduinoCommand, jaiabot_protobuf_ArduinoCommand, 2)
PB_BIND(jaiabot_protobuf_ArduinoResponse, jaiabot_protobuf_ArduinoResponse, 2)

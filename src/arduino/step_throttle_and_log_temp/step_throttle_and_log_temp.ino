#include <Servo.h>
#include <SPI.h>

#include <Adafruit_MAX31855.h>

#define clock_pin 10
#define select_pin 11
#define data_pin 12

Adafruit_MAX31855 thermocouple(clock_pin, select_pin, data_pin);

Servo motor_servo;

const int motor = 6;
int motor_useconds = 1500;

void setup() {
  Serial.begin(19200);
  motor_servo.attach(motor);
  Serial.setTimeout(500000);

  delay(1000);
  motor_servo.writeMicroseconds(motor_useconds);
  delay(1000);
  
  delay(500);
  if (!thermocouple.begin()) {
    while (1) delay(10);
  }
}

void loop() {
  double c = thermocouple.readCelsius();
  Serial.println(c);
  motor_useconds = Serial.parseInt(SKIP_ALL);
  motor_servo.writeMicroseconds(motor_useconds);
}
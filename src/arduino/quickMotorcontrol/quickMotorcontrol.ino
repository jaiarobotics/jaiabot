#include <Servo.h>
#include <SPI.h>

#include <Adafruit_MAX31855.h>

#define Clock 10
#define Data 12
#define ChipSelect 11

Adafruit_MAX31855 thermocouple(Clock, ChipSelect, Data);

Servo motor_servo;

const int motor = 6;
int Motor = 0;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(19200);
  motor_servo.attach(motor);
  Serial.setTimeout(500000);
  int input = Serial.parseInt(SKIP_ALL);
  Motor = map(input, 1100, 1900, -100, 100);
  motor_servo.writeMicroseconds(Motor/4);
  motor_servo.writeMicroseconds(Motor/2);
  motor_servo.writeMicroseconds((Motor/4)*3);
  motor_servo.writeMicroseconds(Motor);
  delay(500);
  if (!thermocouple.begin()) {
    while (1) delay(10);
  }
}

void loop() {
  // put your main code here, to run repeatedly:
  delay(2000);
  double c = thermocouple.readCelsius();
  Serial.println(c);
}

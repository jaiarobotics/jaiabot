#include <Servo.h>
#include <SPI.h>

#include <Adafruit_MAX31855.h>

#define Clock 12
#define Data 10
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
  Motor = map((input/4), -100, 100, 1100, 1900);
  motor_servo.writeMicroseconds(Motor);
  delay(1000);
  Motor = map((input/2), -100, 100, 1100, 1900);
  motor_servo.writeMicroseconds(Motor);
  delay(1000);
  Motor = map(((input/4)*3), -100, 100, 1100, 1900);
  motor_servo.writeMicroseconds(Motor);
  delay(1000);
  Motor = map(input, -100, 100, 1100, 1900);
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

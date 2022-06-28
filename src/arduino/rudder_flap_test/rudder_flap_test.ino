
#include <Servo.h>
Servo rudder_servo, port_servo, starboard_servo, motor_servo;;

const int starboard_flap = 2;
const int rudder = 3;
const int port_flap = 4;
const int motor = 6;

bool Run = false;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(19200);
  rudder_servo.attach(rudder);
  starboard_servo.attach(starboard_flap);
  port_servo.attach(port_flap);
  motor_servo.attach(motor);
  motor_servo.writeMicroseconds(1500);
  Serial.setTimeout(5000);

  do{
    Run = Serial.find("S");
    motor_servo.writeMicroseconds(1600);
    rudder_servo.writeMicroseconds(1000);
    port_servo.writeMicroseconds(1000);
    starboard_servo.writeMicroseconds(1000);
    delay(1000);
    motor_servo.writeMicroseconds(1700);
    delay(1000);
    motor_servo.writeMicroseconds(1600);
    delay(1000);
    motor_servo.writeMicroseconds(1500);
    delay(2000);
    motor_servo.writeMicroseconds(1400);
    rudder_servo.writeMicroseconds(2000);
    port_servo.writeMicroseconds(2000);
    starboard_servo.writeMicroseconds(2000);
    delay(1000);
    motor_servo.writeMicroseconds(1300);
    delay(1000);
    motor_servo.writeMicroseconds(1400);
    delay(1000);
    motor_servo.writeMicroseconds(1500);  
  }while(Run == false);
}

void loop() {

}

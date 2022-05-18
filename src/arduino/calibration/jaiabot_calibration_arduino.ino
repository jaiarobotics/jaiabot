
#include <Servo.h>
Servo rudder_servo, port_servo, starboard_servo, motor_servo;

const int starboard_flap = 2;
const int rudder = 3;
const int port_flap = 4;
const int motor = 6;

//designate the starting ranges (starboard)
int a = 2000;
int b = 1000;
int c = 1500;

//designate the starting ranges (port)
int d = 2000;
int e = 1000;
int f = 1500;

//designate the starting ranges (rudder)
int x = 2000;
int y = 1000;
int z = 1500;

//designate the starting range (motor)
int g = 1500;

//function for  steering bounds creation 
int BoundsCreation(int microseconds, Servo servo){
  int on = 0;
  do{
    servo.writeMicroseconds(microseconds);
    int input = Serial.parseInt(SKIP_ALL);
    microseconds = microseconds-input;
    servo.writeMicroseconds(microseconds);
    bool confirmation = Serial.findUntil("Y","N");
    if (confirmation == true){
      on = on+1;
    }
  }while(on == 0);
  return microseconds;
}

//full steering calibration
int Bounds(int l, int m, int n, Servo servo){
  int completion = 0;
  do{
    l = BoundsCreation(l, servo);
    if (l > 2000){
      l = 2000;
    }
    m = BoundsCreation(m, servo);
    if (m < 1000){
      m = 1000;
    }
    n = BoundsCreation(n, servo);
    bool contentment = Serial.findUntil("X","Z");
    if (contentment == true){
      completion = completion+1;
    }
  }while(completion == 0);
  
  Serial.print(l);
  Serial.print(" ");
  Serial.print(m);
  Serial.print(" ");
  Serial.print(n);
  Serial.println(" ");
}

//for accelerating/decelerating the motor
int motor_forward_speed(int microseconds, Servo servo){
  int initialVal = microseconds;
  int on = 0;
  do{  
    servo.writeMicroseconds(microseconds);
    int input = Serial.parseInt(SKIP_ALL);
    microseconds = initialVal + input;
    servo.writeMicroseconds(microseconds);
    bool confirmation = Serial.findUntil("Y","N");
    if (confirmation == true){
      bool completion = Serial.findUntil("J","K");
      if (completion == true){
        on = on + 1;
      }
      else{
        servo.writeMicroseconds(1500);
        delay(500);
        input = Serial.parseInt(SKIP_ALL);
        microseconds = initialVal + input;
      }
    }
  }while(on == 0);
  return microseconds;
}

//pretty much the same thing, but this one STOPS it
int motor_reverse_speed(int microseconds, Servo servo){
  int initialVal = microseconds;
  int on = 0;
  do{  
    servo.writeMicroseconds(microseconds);
    int input = Serial.parseInt(SKIP_ALL);
    microseconds = initialVal - input;
    servo.writeMicroseconds(microseconds);
    bool confirmation = Serial.findUntil("Y","N");
    if (confirmation == true){
      bool completion = Serial.findUntil("J","K");
      if (completion == true){
        on = on + 1;
      }
      else{
        servo.writeMicroseconds(1500);
        delay(500);
        input = Serial.parseInt(SKIP_ALL);
        microseconds = initialVal - input;
      }
    }
  }while(on == 0);
  return microseconds;
}

//overall motor calibration
int MotorBounds(int microseconds, Servo servo){
  servo.writeMicroseconds(1500);
  
  int startup = motor_forward_speed(microseconds, motor_servo);
  Serial.print(startup);
  int startdown = motor_reverse_speed(microseconds, motor_servo);
  Serial.print(startdown);
  int haltup = motor_reverse_speed(startup, motor_servo);
  Serial.print(haltup);
  int haltdown = motor_forward_speed(startdown, motor_servo);
  Serial.print(haltdown);
  
  servo.writeMicroseconds(1500);
}
void setup() {
  // put your setup code here, to run once:
  Serial.begin(19200);
  rudder_servo.attach(rudder);
  starboard_servo.attach(starboard_flap);
  port_servo.attach(port_flap);
  motor_servo.attach(motor);
  Serial.setTimeout(500000);

  Bounds(a, b, c, starboard_servo);
  Bounds(d, e, f, port_servo);
  Bounds(x, y, z, rudder_servo);
  MotorBounds(g, motor_servo);
}

void loop() {
  // put your main code here, to run repeatedly:

}

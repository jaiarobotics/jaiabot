
#include <Servo.h>
Servo rudder_servo, port_servo, starboard_servo, motor_servo;

const int starboard_flap = 6;
const int rudder = 5;
const int port_flap = 9;
const int motor = 3;

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
  int modifier = microseconds;
  do{
    servo.writeMicroseconds(microseconds);
    int input = Serial.parseInt(SKIP_ALL);
    Serial.print("10-4 good buddy");
    microseconds = modifier-input;
    servo.writeMicroseconds(microseconds);
    bool confirmation = Serial.findUntil("Y","N");
    Serial.print("10-4 good buddy");
    if (confirmation == true){
      on = on+1;
    }
    else if (confirmation == false){
      modifier = microseconds;
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
    Serial.print("10-4 good buddy");
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
int motor_speed(int microseconds, Servo servo, int Direction){
  int on = 0;
  int Step = 0;
  if (Direction == 1){
    Step = 5;
  }
  else if (Direction == 0){
    Step = -5;
  }
  do{ 
    servo.writeMicroseconds(microseconds);
    Serial.println(microseconds);
    bool confirmation = Serial.findUntil("Y","N");
    if (confirmation == true){
      bool completion = Serial.findUntil("J","K");
      if (completion == true){
        on = on + 1;
      }
      else{
        servo.writeMicroseconds(1500);
        delay(500);
        microseconds = microseconds + Step;
      }
    }
    else if (confirmation == false){
      servo.writeMicroseconds(1500);
      delay(500);
      microseconds = microseconds + Step;
    }
  }while(on == 0);
  return microseconds;
}

//overall motor calibration
int MotorBounds(int microseconds, Servo servo){
  servo.writeMicroseconds(1500);
  int on = 0;
  
  do{ 
  
  int startup = motor_speed(1500, motor_servo, 1);
  Serial.println(startup);
  int startdown = motor_speed(1500, motor_servo, 0);
  Serial.println(startdown);
  int haltup = motor_speed(startup, motor_servo, 0);
  Serial.println(haltup);
  int haltdown = motor_speed(startdown, motor_servo, 1);
  Serial.println(haltdown);
  bool completion = Serial.findUntil("C","Z");
      if (completion == true){
        on = on + 1;
      }
  
  }while(on == 0);
  
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

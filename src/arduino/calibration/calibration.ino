
#include <Servo.h>
Servo rudder_servo, port_servo, starboard_servo, motor_servo;

const int starboard_flap = 6;
const int rudder = 5;
const int port_flap = 9;
const int motor = 3;
const int CTRL_ACTS = 10;
const int FAULT_ACTS = 8;
const int POWER_PIN = A1;

//designate the starting range (flaps)
int flaps_upper = 2000;
int flaps_lower = 1000;
int flaps_center = 1500;

//designate the starting range (motor)
int motor_center = 1500;

//function for  steering bounds creation 
int BoundsCreation(int microseconds, Servo servo){
  int on = 0;
  int modifier = microseconds;
  do{
    servo.writeMicroseconds(microseconds);
    int input = Serial.parseInt(SKIP_ALL);
    microseconds = modifier-input;
    servo.writeMicroseconds(microseconds);
    bool confirmation = Serial.findUntil("Y","N");
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
    if (contentment == true){
      completion = completion+1;
    }
  }while(completion == 0);
  
  Serial.print(l);
  Serial.print(" ");
  Serial.print(m);
  Serial.print(" ");
  Serial.print(n);
  Serial.print(" ");
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
    Serial.print(microseconds);
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
int MotorBounds(int micro, Servo servo){
  servo.writeMicroseconds(micro);
  int on = 0;
  
  do{ 
  
  int startup = motor_speed(micro, servo, 1);
  Serial.println(startup);
  int startdown = motor_speed(micro, servo, 0);
  Serial.println(startdown);
  int haltup = motor_speed(startup, servo, 0);
  Serial.println(haltup);
  int haltdown = motor_speed(startdown, servo, 1);
  Serial.println(haltdown);
  bool completion = Serial.findUntil("C","Z");
      if (completion == true){
        on = on + 1;
      }
  
  }while(on == 0);
  
  servo.writeMicroseconds(1500);
}
void setup() {
  //pin setup and Serial begin
  Serial.begin(19200);
  rudder_servo.attach(rudder);
  starboard_servo.attach(starboard_flap);
  port_servo.attach(port_flap);
  motor_servo.attach(motor);
  digitalWrite(POWER_PIN, LOW);
  
  pinMode(CTRL_ACTS, OUTPUT);
  digitalWrite(CTRL_ACTS, LOW);

  pinMode(FAULT_ACTS, INPUT);
  
  Serial.setTimeout(500000);

  motor_servo.writeMicroseconds(motor_center);

  Bounds(flaps_upper, flaps_lower, flaps_center, starboard_servo);
  Bounds(flaps_upper, flaps_lower, flaps_center, port_servo);
  Bounds(flaps_upper, flaps_lower, flaps_center, rudder_servo);
  MotorBounds(motor_center, motor_servo);
}

void loop() {
  // put your main code here, to run repeatedly:

}

const int VvCurrent = A3;
const int VccCurrent = A2;
const int VccVoltage = A0;
const int LED1 = A6;
const int LED2 = A5;
int vccvoltage = 0;
int vcccurrent = 0;
int Vvcurrent = 0;
void setup() {
  // put your setup code here, to run once:
pinMode(VccCurrent, INPUT);
pinMode(VccVoltage, INPUT);
pinMode(VvCurrent, INPUT);
pinMode(LED1, OUTPUT);
pinMode(LED2, OUTPUT);
Serial.begin(19200);
}

void loop() {
  // put your main code here, to run repeatedly:
analogWrite(LED1, 255);
analogWrite(LED2, 0);
vccvoltage = analogRead(VccVoltage);
vcccurrent = analogRead(VccCurrent);
Vvcurrent = analogRead(VvCurrent);
Serial.println(vccvoltage);
Serial.println(vcccurrent);
Serial.println(Vvcurrent);
delay(1500);
analogWrite(LED1, 0);
analogWrite(LED2, 255);
delay(1500);
}

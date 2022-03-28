#include <SPI.h>

void setup()
{

  Serial.begin(57600);
  while (!Serial) {
    delay(1);
  }

  delay(100);

}


unsigned char c = 0;

void loop()
{

  Serial.write("Test B\n\r");
  delay(500);

}

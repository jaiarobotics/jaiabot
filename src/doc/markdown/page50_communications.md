# Communications

## LoRa

We're using the Adafruit Feather 32u4 with RFM9x LoRa Radio. This is a microcontroller running Arduino that talks directly to the radio via SPI, and to the Linux system via USB-serial.

### Software

On Ubuntu 20.04:

- [Arduino 1.8.15](https://www.arduino.cc/en/software)
    - [Adafruit AVR Boards package (1.4.3)](https://learn.adafruit.com/adafruit-feather-32u4-radio-with-lora-radio-module/using-with-arduino-ide)
- [RadioHead version 1.117](http://www.airspayce.com/mikem/arduino/RadioHead/RadioHead-1.117.zip)

Install required thirdparty libraries:

```
cd ~/Arduino/libraries
ln -s ~/opensource/jaiabot/src/arduino/libraries/RadioHead .
ln -s ~/opensource/jaiabot/src/arduino/libraries/nanopb-0.4.1 .
ln -s ~/opensource/jaiabot/src/arduino/libraries/base64-1.2.0  .
```


### References

- <https://learn.adafruit.com/adafruit-feather-32u4-radio-with-lora-radio-module/using-the-rfm-9x-radio>
- <http://www.airspayce.com/mikem/arduino/RadioHead/>

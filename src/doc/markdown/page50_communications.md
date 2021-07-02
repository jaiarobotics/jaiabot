# Communications

## LoRa

We're using the Adafruit Feather 32u4 with RFM9x LoRa Radio. This is a microcontroller running Arduino that talks directly to the radio via SPI, and to the Linux system via USB-serial.

### Software

On Ubuntu 20.04:

- [Arduino 1.8.15](https://www.arduino.cc/en/software) or arduino-cli (see below)
    - [Adafruit AVR Boards package (1.4.3)](https://learn.adafruit.com/adafruit-feather-32u4-radio-with-lora-radio-module/using-with-arduino-ide)
- [RadioHead version 1.117](http://www.airspayce.com/mikem/arduino/RadioHead/RadioHead-1.117.zip)
- [Nanopb 0.4.1](https://jpa.kapsi.fi/nanopb/download/nanopb-0.4.1.tar.gz)

Install required thirdparty libraries:

```
cd ~/Arduino/libraries
ln -s ~/jaiabot/src/arduino/libraries/RadioHead-1.117 .
ln -s ~/opensource/jaiabot/src/arduino/libraries/nanopb-0.4.1 .
```

#### arduino-cli

Instead of the graphical Arduino, you can install the [arduino-cli](https://github.com/arduino/arduino-cli) and set it up as follows:

```
arduino-cli config init --additional-urls  https://adafruit.github.io/arduino-board-index/package_adafruit_index.json
arduino-cli core update-index
arduino-cli core install adafruit:avr
arduino-cli board list
```

#### Feather code

Flash application in `jaiabot/src/arduino/feather_lora9x/jaiabot_lora` using Arduino IDE (`jaiabot` must be [compiled normally](page20_build.md) before flashing with Arduino so that the Protobuf messages are compiled).

Or with the `arduino-cli`:

```
adafruit:avr:feather32u4
arduino-cli compile -b adafruit:avr:feather32u4 
arduino-cli upload -p /dev/ttyACM0 -b adafruit:avr:feather32u4
```

A binary serial interface centered around the `jaiabot::protobuf::LoRaMessage` Protobuf message is used to communicate between the main vehicle computer and the Adafruit Feather. This protocol is a simple wrapper around the Protobuf message:

```
[Magic word (4-bytes): "JAIA"][Size of message = N (2-bytes), big-endian][Protobuf Encoded LoRaMessage (N bytes)]
```

The actual `jaiabot::protobuf::LoRaMessage` contains most of the interesting data:

- `src`: Identification number for the sending modem
- `dest`: Identification number for the destination modem
- `data`: Message data (meaning depends on `type` field)
- `type`: Type of message between the Feather and the main (control) computer
    - `LORA_DATA`: Binary data (`data` field) to be sent (control -> feather) or received from (feather -> control) the radios.
    - `SET_PARAMETERS`: (control -> feather). Set the Feather parameters (currently only the modem address, using the `src` field).
    - `PARAMETERS_ACCEPTED`: (feather -> control). Ack of successful setting of parameters previously requested with `SET_PARAMETERS`.
    - `FEATHER_READY`: (feather -> control). Sent once by the Feather after initializing the radio.
    - `TRANSMIT_RESULT`: (feather -> control). Result (success / failure) of the previous transmission.
    - `DEBUG_MESSAGE`: String message (in the `data` field) contain human-readable debug information.
- `id`: Message ID from RadioHead (seems to be zero)
- `flags`: Flags from RadioHead (also seems to be zero)
- `rssi`: Received Signal Strength Indicator reported by the radio.

#### Jaiabot code

So far we have a test application (`jaiabot_lora_test`) that sends messages between two radios.

To run the code:

```
jaiabot_lora_test --serial 'port: "/dev/ttyACM0" baud: 115200' -vvv -n --src 1 --dest 2 --transmit
jaiabot_lora_test --serial 'port: "/dev/ttyACM1" baud: 115200' -vvv -n --src 2 --dest 1 --transmit
```

Currently the test program transmits every twenty seconds, using a basic TDMA with slot length 10 seconds.


### References

- <https://learn.adafruit.com/adafruit-feather-32u4-radio-with-lora-radio-module/using-the-rfm-9x-radio>
- <http://www.airspayce.com/mikem/arduino/RadioHead/>

#include <SPI.h>
#include <RH_RF95.h>
#include <RHDatagram.h>
#include <pb_decode.h>
#include <pb_encode.h>
#include <base64.hpp>
#include "jaiabot/messages/nanopb/feather.pb.h"

/* for feather32u4 */
#define RFM95_CS 8
#define RFM95_RST 4
#define RFM95_INT 7

#define RF95_FREQ 915.0

// Singleton instance of the radio driver
RH_RF95 rf95(RFM95_CS, RFM95_INT);
uint8_t this_address = 2;
RHDatagram rh_manager(rf95, this_address);

// ASCII Serial Protocol
// Prefix byte + ':' + Data
// P:[Base64 Encoded jaiabot_protobuf_LoRaMessage Protobuf Data]
// D:[Debug String message]

// prefix + ':'
#define SERIAL_HEADER_SIZE 2
// new line
#define EOL_SIZE 1

// 8 bits -> 6 bits
constexpr int JB_MAX_SERIAL_LINE_LENGTH = SERIAL_HEADER_SIZE + ceil(jaiabot_protobuf_LoRaMessage_size * 3) / 4 + EOL_SIZE;
char serial_buffer[JB_MAX_SERIAL_LINE_LENGTH] = {0};

jaiabot_protobuf_LoRaMessage outgoing_msg = jaiabot_protobuf_LoRaMessage_init_default;
jaiabot_protobuf_LoRaMessage incoming_msg = jaiabot_protobuf_LoRaMessage_init_default;

bool data_to_send = false;

void print_msg(const jaiabot_protobuf_LoRaMessage& msg)
{
  Serial.print("src: ");
  Serial.print(msg.src);
  Serial.print(", dest: ");
  Serial.print(msg.dest);
  Serial.print(", data: ");
  for (int i = 0, n = msg.data.size; i < n; ++i)
  {
    Serial.print(msg.data.bytes[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
  delay(10);
}

void setup()
{
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);

  Serial.begin(115200);
  while (!Serial) {
    delay(1);
  }

  delay(100);

  Serial.println("D:JaiaBot LoRa");

  jaiabot_protobuf_LoRaMessage lora_msg{};


  // manual reset
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  while (!rh_manager.init()) {
    Serial.println("D:LoRa radio init failed");
    Serial.println("D:Uncomment '#define SERIAL_DEBUG' in RH_RF95.cpp for detailed debug info");
    while (1);
  }
  Serial.println("D:LoRa radio init OK!");

  // Defaults after init are 434.0MHz, modulation GFSK_Rb250Fd250, +13dbM
  if (!rf95.setFrequency(RF95_FREQ)) {
    Serial.println("D:setFrequency failed");
    while (1);
  }
  Serial.print("D:Set Freq to: "); Serial.println(RF95_FREQ);

  // Defaults after init are 434.0MHz, 13dBm, Bw = 125 kHz, Cr = 4/5, Sf = 128chips/symbol, CRC on

  // The default transmitter power is 13dBm, using PA_BOOST.
  // If you are using RFM95/96/97/98 modules which uses the PA_BOOST transmitter pin, then
  // you can set transmitter powers from 5 to 23 dBm:
  rf95.setTxPower(5, false);

}

int16_t packetnum = 0;  // packet counter, we increment per xmission

void lora_tx()
{
  if (outgoing_msg.src != this_address)
  {
    this_address = outgoing_msg.src;
    Serial.print("D:Updated this address to ");
    Serial.println(this_address);
    delay(10);
    rh_manager.setThisAddress(this_address);

    delay(10);
  }
  Serial.println("D:Sending...");
  delay(10);
  rh_manager.sendto((uint8_t *)outgoing_msg.data.bytes, outgoing_msg.data.size, outgoing_msg.dest);
  Serial.println("D:Waiting for packet to complete...");
  delay(10);
  if (rh_manager.waitPacketSent(1000 /*ms*/))
    Serial.println("D:...send complete");
  else
    Serial.println("D:...timeout on send");
  data_to_send = false;
  delay(10);
}

void lora_rx()
{
  incoming_msg = jaiabot_protobuf_LoRaMessage_init_default;
  uint8_t size = sizeof(incoming_msg.data.bytes);
  uint8_t src = 0;
  uint8_t dest = 0;
  uint8_t id = 0;
  uint8_t flags = 0;

  while (rh_manager.waitAvailableTimeout(100))
  {
    if (rh_manager.recvfrom(incoming_msg.data.bytes, &size, &src, &dest, &id, &flags))
    {
      incoming_msg.data.size = size;
      incoming_msg.src = src;
      incoming_msg.dest = dest;
      incoming_msg.id = id;
      incoming_msg.has_id = true;
      incoming_msg.flags = flags;
      incoming_msg.has_flags = true;

      Serial.print("D:incoming - ");
      print_msg(incoming_msg);
      Serial.print("D:RSSI: ");
      Serial.println(rf95.lastRssi(), DEC);
    }
    else
    {
      Serial.println("D:Receive failed");
    }
  }
}

void loop()
{
  lora_rx();
  
  if (data_to_send)
    lora_tx();


  while (Serial.available() > 0) {
    // read prefix
    auto prefix = Serial.read();
    auto colon = Serial.read();
    if (colon != ':')
    {
      Serial.print("D:Malformed message, expected colon after prefix ");
      Serial.print(prefix);
      Serial.println(colon);
    }
    else
    {
      auto bytes_read = Serial.readBytesUntil('\n', serial_buffer, JB_MAX_SERIAL_LINE_LENGTH);

      switch (prefix)
      {
        // Protobuf message (base 64 encoded)
        case 'P':
          outgoing_msg = jaiabot_protobuf_LoRaMessage_init_default;
          char binary_data[jaiabot_protobuf_LoRaMessage_size];
          auto binary_length = decode_base64(serial_buffer, binary_data);

          pb_istream_t stream = pb_istream_from_buffer(binary_data, binary_length);

          bool status = pb_decode(&stream, jaiabot_protobuf_LoRaMessage_fields, &outgoing_msg);
          if (!status)
          {
            Serial.print("D:Decoding LoRaMessage protobuf failed:");
            Serial.println(PB_GET_ERROR(&stream));
          }
          else
          {
            Serial.print("D:outgoing - ");
            print_msg(outgoing_msg);
            data_to_send = true;
          }

          break;
        // Debug message (string)
        case 'D':
          break;
        default:
          Serial.print("D:Unknown prefix ");
          Serial.println(prefix);
          break;
      }
    }
  }
}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_LoRaMessage, jaiabot_protobuf_LoRaMessage, 2)

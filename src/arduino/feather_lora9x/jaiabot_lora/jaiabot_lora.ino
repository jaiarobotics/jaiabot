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

bool data_to_send = false;
bool data_to_receive = false;

jaiabot_protobuf_LoRaMessage msg = jaiabot_protobuf_LoRaMessage_init_default;

//void print_msg(const jaiabot_protobuf_LoRaMessage& msg)
//{
//  Serial.print("src: ");
//  Serial.print(msg.src);
//  Serial.print(", dest: ");
//  Serial.print(msg.dest);
//  Serial.print(", data: ");
//  for (int i = 0, n = msg.data.size; i < n; ++i)
//  {
//    Serial.print(msg.data.bytes[i], HEX);
//    Serial.print(" ");
//  }
//  Serial.println();
//  delay(100);
//}

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

void lora_tx()
{
  if (msg.src != this_address)
  {
    this_address = msg.src;
    Serial.print("D:Updated this address to ");
    Serial.println(this_address);
    delay(10);
    rh_manager.setThisAddress(this_address);

    delay(10);
  }
  Serial.println("D:Sending...");
  delay(10);
  rh_manager.sendto((uint8_t *)msg.data.bytes, msg.data.size, msg.dest);
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
  msg = jaiabot_protobuf_LoRaMessage_init_default;
  uint8_t size = sizeof(msg.data.bytes);
  uint8_t src = 0;
  uint8_t dest = 0;
  uint8_t id = 0;
  uint8_t flags = 0;

  if (rh_manager.recvfrom(msg.data.bytes, &size, &src, &dest, &id, &flags))
  {
    msg.data.size = size;
    msg.src = src;
    msg.dest = dest;
    msg.id = id;
    msg.has_id = true;
    msg.flags = flags;
    msg.has_flags = true;

    //Serial.print("D:incoming - ");
    //print_msg(msg);
    Serial.print("D:received bytes:" );
    Serial.println(size);
    Serial.print("D:RSSI: ");
    Serial.println(rf95.lastRssi(), DEC);
    data_to_receive = true;
  }
  else
  {
    Serial.println("D:Receive failed");
  }

  if (data_to_receive)
  {
    bool status = true;
    uint8_t pb_binary_data[jaiabot_protobuf_LoRaMessage_size] = {0};
    size_t message_length = 0;
    {
      {
        pb_ostream_t stream = pb_ostream_from_buffer(pb_binary_data, sizeof(pb_binary_data));
        status = pb_encode(&stream, jaiabot_protobuf_LoRaMessage_fields, &msg);
        message_length = stream.bytes_written;
        Serial.println(message_length);
        //     if (!status)
        //{
        //          Serial.print("D:Encoding LoRaMessage protobuf failed:");
        //Serial.println(PB_GET_ERROR(&stream));
        //}
      }
    }



    if (status)
    {
      uint8_t serial_buffer[JB_MAX_SERIAL_LINE_LENGTH] = {0};
      int binary_length = encode_base64(pb_binary_data, message_length, serial_buffer);
      Serial.print("P:");
      Serial.write(serial_buffer, binary_length);
      Serial.println();
      delay(10);
    }
    data_to_receive = false;
  }


}

void loop()
{
  if (rh_manager.available())
    lora_rx();

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
      switch (prefix)
      {
        // Protobuf message (base 64 encoded)
        case 'P':
          msg = jaiabot_protobuf_LoRaMessage_init_default;
          int binary_length = 0;
          bool status = false;
          {
            uint8_t pb_binary_data[jaiabot_protobuf_LoRaMessage_size] = {0};
            // scope serial buffer to minimize RAM usage
            {
              uint8_t serial_buffer[JB_MAX_SERIAL_LINE_LENGTH] = {0};
              auto bytes_read = Serial.readBytesUntil('\n', serial_buffer, JB_MAX_SERIAL_LINE_LENGTH);
              binary_length = decode_base64(serial_buffer, pb_binary_data);
            }
            pb_istream_t stream = pb_istream_from_buffer(pb_binary_data, binary_length);
            status = pb_decode(&stream, jaiabot_protobuf_LoRaMessage_fields, &msg);
            if (!status)
            {
              Serial.print("D:Decoding LoRaMessage protobuf failed:");
              Serial.println(PB_GET_ERROR(&stream));
            }

          }
          if (status)
          {
            Serial.print("D:outgoing - ");
            //     print_msg(msg);
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

  if (data_to_send)
    lora_tx();
}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_LoRaMessage, jaiabot_protobuf_LoRaMessage, 2)

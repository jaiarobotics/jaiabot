#include <SPI.h>
#include <RH_RF95.h>
#include <RHDatagram.h>
#include <pb_decode.h>
#include <pb_encode.h>
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

// Binary serial protocol
// [JAIA][2-byte size - big endian][bytes][JAIA]...
// TODO: Add CRC32?
constexpr const char* SERIAL_MAGIC = "JAIA";
constexpr int SERIAL_MAGIC_BYTES = 4;
constexpr int SIZE_BYTES = 2;
using serial_size_type = uint16_t;

constexpr int BITS_IN_BYTE = 8;

constexpr auto MAX_SIZE = 1ul << (SIZE_BYTES*BITS_IN_BYTE);

static_assert(jaiabot_protobuf_LoRaMessage_size < MAX_SIZE, "LoRaMessage is too large, must fit in SIZE_BYTES word");

bool data_to_send = false;
bool data_to_receive = false;

jaiabot_protobuf_LoRaMessage msg = jaiabot_protobuf_LoRaMessage_init_default;
//
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
//  delay(10);
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

 // Serial.println("D:JaiaBot LoRa");

  // manual reset
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  while (!rh_manager.init()) {
   // Serial.println("D:LoRa radio init failed");
   // Serial.println("D:Uncomment '#define SERIAL_DEBUG' in RH_RF95.cpp for detailed debug info");
    while (1);
  }
  //Serial.println("D:LoRa radio init OK!");

  // Defaults after init are 434.0MHz, modulation GFSK_Rb250Fd250, +13dbM
  if (!rf95.setFrequency(RF95_FREQ)) {
    //Serial.println("D:setFrequency failed");
    while (1);
  }
  //Serial.print("D:Set Freq to: "); Serial.println(RF95_FREQ);

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
    //Serial.print("D:Updated this address to ");
    //Serial.println(this_address);
    //delay(10);
    rh_manager.setThisAddress(this_address);
    delay(10);
  }
  //Serial.println("D:Sending...");
  //delay(10);
  rh_manager.sendto((uint8_t *)msg.data.bytes, msg.data.size, msg.dest);
  //Serial.println("D:Waiting for packet to complete...");
  //delay(10);
  if (rh_manager.waitPacketSent(1000 /*ms*/))
  {
    //Serial.println("D:...send complete");
  }
  else
  {
    //Serial.println("D:...timeout on send");
  }
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
    //Serial.print("D:received bytes:" );
    //Serial.println(size);
    //Serial.print("D:RSSI: ");
    //Serial.println(rf95.lastRssi(), DEC);
    data_to_receive = true;
  }
  else
  {
    //Serial.println("D:Receive failed");
  }

  if (data_to_receive)
  {
    bool status = true;
    uint8_t pb_binary_data[jaiabot_protobuf_LoRaMessage_size] = {0};
    serial_size_type message_length = 0;
    {
      {
        pb_ostream_t stream = pb_ostream_from_buffer(pb_binary_data, sizeof(pb_binary_data));
        status = pb_encode(&stream, jaiabot_protobuf_LoRaMessage_fields, &msg);
        message_length = stream.bytes_written;
        //Serial.println(message_length);
        if (!status)
        {
          //Serial.print("D:Encoding LoRaMessage protobuf failed:");
          //Serial.println(PB_GET_ERROR(&stream));
        }
      }
    }



    if (status)
    {
      Serial.write(SERIAL_MAGIC, SERIAL_MAGIC_BYTES);
      Serial.write((message_length >> BITS_IN_BYTE) & 0xFF);
      Serial.write(message_length & 0xFF);
      Serial.write(pb_binary_data, message_length);
    }
    data_to_receive = false;
  }
}

void loop()
{
  if (rh_manager.available())
    lora_rx();

  constexpr int prefix_size = SERIAL_MAGIC_BYTES + SIZE_BYTES;
  while (Serial.available() >= prefix_size)
  {
    // read bytes until the next magic word start (hopefully)
    while (Serial.available() > 0  && Serial.peek() != SERIAL_MAGIC[0])
      Serial.read();

    uint8_t prefix[prefix_size] = {0};
    if (Serial.readBytes(prefix, prefix_size) == prefix_size)
    {
      if (memcmp(SERIAL_MAGIC, prefix, SERIAL_MAGIC_BYTES) == 0)
      {
        serial_size_type size = 0;
        size |= prefix[SERIAL_MAGIC_BYTES];
        size << BITS_IN_BYTE;
        size |= prefix[SERIAL_MAGIC_BYTES + 1];
        //Serial.print("D:Expecting message of size: ");
        //Serial.println(size);

        if (size <= jaiabot_protobuf_LoRaMessage_size)
        {
          uint8_t pb_binary_data[jaiabot_protobuf_LoRaMessage_size] = {0};
          if (Serial.readBytes(pb_binary_data, size) == size)
          {
            pb_istream_t stream = pb_istream_from_buffer(pb_binary_data, size);
            bool status = pb_decode(&stream, jaiabot_protobuf_LoRaMessage_fields, &msg);
            if (!status)
            {
              //Serial.print("D:Decoding LoRaMessage protobuf failed:");
              //Serial.println(PB_GET_ERROR(&stream));
            }
            //Serial.print("D:outgoing - ");
            //print_msg(msg);
            data_to_send = true;
          }
          else
          {
            //Serial.println("D:Read wrong number of bytes for PB data");
          }
        }
        else
        {
          //Serial.print("D:Size is wrong, expected <= ");
          //Serial.println(jaiabot_protobuf_LoRaMessage_size);
        }

      }
      else
      {
        //Serial.print("D:Serial magic is wrong, expected");
        //Serial.println(SERIAL_MAGIC);
      }
    }
    else
    {
      //Serial.println("D:Read wrong number of bytes for prefix");
    }
  }

  if (data_to_send)
    lora_tx();
}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_LoRaMessage, jaiabot_protobuf_LoRaMessage, 2)

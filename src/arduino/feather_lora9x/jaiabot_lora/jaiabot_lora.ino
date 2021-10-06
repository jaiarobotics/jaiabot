#include <SPI.h>
#include <RH_RF95.h>
#include <RHDatagram.h>
#include <pb_decode.h>
#include <pb_encode.h>

//#define JAIABOT_DEBUG

#ifdef JAIABOT_DEBUG
#define DEBUG_MESSAGE(s) debug_message(s)
#else
#define DEBUG_MESSAGE(s)
#endif

#ifdef UENUM
#undef UENUM
#endif
#include "jaiabot/messages/nanopb/feather.pb.h"

/* for feather32u4 */
#define RFM95_CS 8
#define RFM95_RST 4
#define RFM95_INT 7

#define RF95_FREQ 915.0

// Singleton instance of the radio driver
RH_RF95 rf95(RFM95_CS, RFM95_INT);
uint8_t this_address = 0;
RHDatagram rh_manager(rf95, this_address);

// Binary serial protocol
// [JAIA][2-byte size - big endian][bytes][JAIA]...
// TODO: Add CRC32?
constexpr const char* SERIAL_MAGIC = "JAIA";
constexpr int SERIAL_MAGIC_BYTES = 4;
constexpr int SIZE_BYTES = 2;
using serial_size_type = uint16_t;

constexpr int BITS_IN_BYTE = 8;


static_assert(jaiabot_protobuf_LoRaMessage_size < (1ul << (SIZE_BYTES*BITS_IN_BYTE)), "LoRaMessage is too large, must fit in SIZE_BYTES word");

bool data_to_send = false;
bool data_to_receive = false;

jaiabot_protobuf_LoRaMessage msg = jaiabot_protobuf_LoRaMessage_init_default;

#ifdef JAIABOT_DEBUG
void debug_message(const char* s)
{
  msg = jaiabot_protobuf_LoRaMessage_init_default;
  size_t s_len = strlen(s), max_data = sizeof(msg.data.bytes);
  msg.data.size = min(s_len, max_data);
  memcpy(msg.data.bytes, s, msg.data.size);
  msg.has_data = true;
  msg.src = this_address;
  msg.dest = this_address;
  msg.type = jaiabot_protobuf_LoRaMessage_MessageType_DEBUG_MESSAGE;
  send_serial_msg();
}


void debug_message(const String& s)
{
  debug_message(s.c_str());
}
#endif

void send_serial_msg()
{
  bool status = true;
  uint8_t pb_binary_data[jaiabot_protobuf_LoRaMessage_size] = {0};
  serial_size_type message_length = 0;
  {
    {
      pb_ostream_t stream = pb_ostream_from_buffer(pb_binary_data, sizeof(pb_binary_data));
      status = pb_encode(&stream, jaiabot_protobuf_LoRaMessage_fields, &msg);
      message_length = stream.bytes_written;
    }
  }
  if (status)
  {
    Serial.write(SERIAL_MAGIC, SERIAL_MAGIC_BYTES);
    Serial.write((message_length >> BITS_IN_BYTE) & 0xFF);
    Serial.write(message_length & 0xFF);
    Serial.write(pb_binary_data, message_length);
  }
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

  DEBUG_MESSAGE("JaiaBot Lora Starting Up");

  // manual reset
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  while (!rh_manager.init()) {
    DEBUG_MESSAGE("LoRa radio init failed");
    DEBUG_MESSAGE("Uncomment '#define SERIAL_DEBUG' in RH_RF95.cpp for detailed debug info");
    while (1);
  }
  DEBUG_MESSAGE("LoRa radio init OK!");

  // Defaults after init are 434.0MHz, modulation GFSK_Rb250Fd250, +13dbM
  if (!rf95.setFrequency(RF95_FREQ)) {
    DEBUG_MESSAGE("setFrequency failed");
    while (1);
  }

  DEBUG_MESSAGE(String("Set Freq to: " + String(RF95_FREQ)));

  // Defaults after init are 434.0MHz, 13dBm, Bw = 125 kHz, Cr = 4/5, Sf = 128chips/symbol, CRC on
  // The default transmitter power is 13dBm, using PA_BOOST.


  msg = jaiabot_protobuf_LoRaMessage_init_default;
  msg.src = this_address;
  msg.dest = this_address;
  msg.type = jaiabot_protobuf_LoRaMessage_MessageType_FEATHER_READY;
  send_serial_msg();
}

void set_parameters()
{
  if (msg.src != this_address)
  {
    this_address = msg.src;

    DEBUG_MESSAGE(String("Updated this address to: " + String(this_address)));
    rh_manager.setThisAddress(this_address);
  }

  // If you are using RFM95/96/97/98 modules which uses the PA_BOOST transmitter pin, then
  // you can set transmitter powers from 5 to 23 dBm:

  bool cfg_ok = true;
  if(msg.has_tx_power)
    rf95.setTxPower(msg.tx_power, false);

  if(msg.has_modem_config)
  {
      switch(msg.modem_config)
      {
          case jaiabot_protobuf_LoRaMessage_ModemConfigChoice_Bw125Cr45Sf128:
              cfg_ok = rf95.setModemConfig(RH_RF95::Bw125Cr45Sf128);
              break;
          case jaiabot_protobuf_LoRaMessage_ModemConfigChoice_Bw500Cr45Sf128:
              cfg_ok = rf95.setModemConfig(RH_RF95::Bw500Cr45Sf128);
              break;
          case jaiabot_protobuf_LoRaMessage_ModemConfigChoice_Bw31_25Cr48Sf512:
              cfg_ok = rf95.setModemConfig(RH_RF95::Bw31_25Cr48Sf512);
              break;
          case jaiabot_protobuf_LoRaMessage_ModemConfigChoice_Bw125Cr48Sf4096:
              cfg_ok = rf95.setModemConfig(RH_RF95::Bw125Cr48Sf4096);
              break;
          case jaiabot_protobuf_LoRaMessage_ModemConfigChoice_Bw125Cr45Sf2048:
              cfg_ok = rf95.setModemConfig(RH_RF95::Bw125Cr45Sf2048);
              break;
      }
  }

  msg = jaiabot_protobuf_LoRaMessage_init_default;
  msg.src = this_address;
  msg.dest = this_address;
  if(cfg_ok)
      msg.type = jaiabot_protobuf_LoRaMessage_MessageType_PARAMETERS_ACCEPTED;
  else
      msg.type = jaiabot_protobuf_LoRaMessage_MessageType_PARAMETERS_REJECTED;
  
  send_serial_msg();

}


void lora_tx()
{

  rh_manager.sendto((uint8_t *)msg.data.bytes, msg.data.size, msg.dest);

  bool transmit_successful = false;
  if (rh_manager.waitPacketSent(1000 /*ms*/))
  {
    transmit_successful = true;
  }
  else
  {
    transmit_successful = false;
    DEBUG_MESSAGE("Timeout on send");
  }

  msg = jaiabot_protobuf_LoRaMessage_init_default;
  msg.src = this_address;
  msg.dest = this_address;
  msg.type = jaiabot_protobuf_LoRaMessage_MessageType_TRANSMIT_RESULT;
  msg.transmit_successful = true;
  msg.has_transmit_successful = transmit_successful;
  send_serial_msg();

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
    msg.has_data = true;
    msg.src = src;
    msg.dest = dest;
    msg.id = id;
    msg.has_id = true;
    msg.flags = flags;
    msg.has_flags = true;
    msg.type = jaiabot_protobuf_LoRaMessage_MessageType_LORA_DATA;
    msg.rssi = rf95.lastRssi();
    msg.has_rssi = true;
    data_to_receive = true;
  }
  else
  {
    DEBUG_MESSAGE("Receive failed");
  }

  if (data_to_receive)
  {
    send_serial_msg();
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

        if (size <= jaiabot_protobuf_LoRaMessage_size)
        {
          uint8_t pb_binary_data[jaiabot_protobuf_LoRaMessage_size] = {0};
          if (Serial.readBytes(pb_binary_data, size) == size)
          {
            pb_istream_t stream = pb_istream_from_buffer(pb_binary_data, size);
            bool status = pb_decode(&stream, jaiabot_protobuf_LoRaMessage_fields, &msg);
            if (!status)
            {
              DEBUG_MESSAGE("Decoding LoRaMessage protobuf failed:");
              DEBUG_MESSAGE(PB_GET_ERROR(&stream));
            }
            switch (msg.type)
            {
              default:
                break;
              case jaiabot_protobuf_LoRaMessage_MessageType_LORA_DATA:
                data_to_send = true;
                break;
              case jaiabot_protobuf_LoRaMessage_MessageType_SET_PARAMETERS:
                set_parameters();
                break;
            }
          }
          else
          {
            DEBUG_MESSAGE("Read wrong number of bytes for PB data");
          }
        }
        else
        {
          DEBUG_MESSAGE("Size is wrong, expected <= jaiabot_protobuf_LoRaMessage_size");
        }

      }
      else
      {
        DEBUG_MESSAGE("Serial magic is wrong");
      }
    }
    else
    {
      DEBUG_MESSAGE("Read wrong number of bytes for prefix");
    }
  }

  if (data_to_send)
    lora_tx();
}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_LoRaMessage, jaiabot_protobuf_LoRaMessage, 2)

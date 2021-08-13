#include <SPI.h>
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

  Serial.begin(115200);
  while (!Serial) {
    delay(1);
  }

  delay(100);

}


void loop()
{

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

}

// from feather.pb.c - would be better to just add the file to the sketch
// but unclear how to do some from Arduino
PB_BIND(jaiabot_protobuf_LoRaMessage, jaiabot_protobuf_LoRaMessage, 2)

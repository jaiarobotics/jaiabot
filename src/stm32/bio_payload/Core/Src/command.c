/*
 * command.c
 *
 *  Created on: Mar 5, 2025
 *      Author: ColinVincent
 */


#include "command.h"
#include "cobs.h"
#include <pb_encode.h>
#include <pb_decode.h>

// Command Processing
UART_QUEUE uQueue;
uint8_t msg[256];
#define DECODED_MSG_SIZE 256
// Number of bytes in CRC32 
#define CRC32_SIZE 4
// Bit shift factor
#define BITS_IN_BYTE 8

SensorRequest process_cmd(void)
{
  SensorRequest message = jaiabot_sensor_protobuf_SensorRequest_init_zero;
  if (uQueue.msgCount > 0)
  {
    // First calculate which message we need to process from the queue (0 - 16). wIndex - msgCount
    uQueue.rIndex = uQueue.wIndex - uQueue.msgCount;
    uQueue.rIndex = (uQueue.rIndex < 0) ? (uQueue.rIndex + UART_QUEUE_SIZE) : uQueue.rIndex;

    uQueue.msgCount--;

    // Buffer to hold decoded message
    uint8_t decoded_msg[DECODED_MSG_SIZE] = {0};

    // Perform COBS decoding
    COBSUnStuffData((const unsigned char*)uQueue.msgQueue[uQueue.rIndex],
                    strlen((char*)uQueue.msgQueue[uQueue.rIndex]),
                    decoded_msg);


    uint8_t decoded_length = 0;

    for (int i = DECODED_MSG_SIZE - 1; i > 0; --i)
    {
      if (decoded_msg[i] != 0)
      {
        decoded_length = i + 1;
        break;
      }
    }

    // Ensure message has enough bytes for CRC32 verification
    if (decoded_length < CRC32_SIZE) {
        return message;
    }

    // Compute CRC32 of the actual message (excluding last 4 bytes)
    uint32_t computed_crc = compute_crc32(decoded_msg, decoded_length - CRC32_SIZE);

    // Extract the provided CRC32 from the last 4 bytes of the message
    uint32_t provided_crc = 0;
    for (size_t i = 0; i < CRC32_SIZE; i++) {
        provided_crc |= decoded_msg[decoded_length - CRC32_SIZE + i] << ((CRC32_SIZE - i - 1) * BITS_IN_BYTE);
    }

    // Validate CRC32
    if (computed_crc != provided_crc) {
        return message;
    }

    // Create a protobuf input stream
    pb_istream_t istream = pb_istream_from_buffer(decoded_msg, decoded_length - CRC32_SIZE);
    if (!pb_decode(&istream, &jaiabot_sensor_protobuf_SensorRequest_msg, &message)) {
        return message;
    }

    return message;
  }
  return message;
}

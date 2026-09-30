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

  // Take one snapshot of the producer's index. Anything the RX ISR appends
  // after this point is simply picked up on the next call.
  uint8_t read_index = uQueue.rIndex;
  uint8_t write_index = uQueue.wIndex;

  if (read_index != write_index)
  {
      // Don't let the slot read be hoisted above the wIndex load that published it.
      UART_QUEUE_BARRIER();

      // Buffer to hold decoded message
      uint8_t decoded_msg[DECODED_MSG_SIZE] = {0};

      // Perform COBS decoding
      unsigned long decoded_length =
          COBSUnStuffData((const unsigned char*)uQueue.msgQueue[read_index],
                          strlen((char*)uQueue.msgQueue[read_index]), decoded_msg);

      // Release the slot before validating, so a malformed message can't stall the queue.
      UART_QUEUE_BARRIER();
      uQueue.rIndex = UART_QUEUE_NEXT(read_index);

      // Check the length fits and covers the CRC32. Use the decoder's length, not a scan for
      // the last non-zero byte, which would truncate a CRC ending in 0x00.
      if (decoded_length < CRC32_SIZE || decoded_length > DECODED_MSG_SIZE)
      {
          return message;
      }

      // Compute CRC32 of the actual message (excluding last 4 bytes)
      uint32_t computed_crc = compute_crc32(decoded_msg, decoded_length - CRC32_SIZE);

      // Extract the provided CRC32 from the last 4 bytes of the message
      uint32_t provided_crc = 0;
      for (size_t i = 0; i < CRC32_SIZE; i++)
      {
          provided_crc |= decoded_msg[decoded_length - CRC32_SIZE + i]
                          << ((CRC32_SIZE - i - 1) * BITS_IN_BYTE);
      }

      // Validate CRC32
      if (computed_crc != provided_crc)
      {
          return message;
      }

      // Create a protobuf input stream
      pb_istream_t istream = pb_istream_from_buffer(decoded_msg, decoded_length - CRC32_SIZE);
      if (!pb_decode(&istream, &jaiabot_sensor_protobuf_SensorRequest_msg, &message))
      {
          return message;
      }

      return message;
  }
  return message;
}

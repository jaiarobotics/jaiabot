#ifndef SERIAL_H
#define SERIAL_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <pb_encode.h>

#include "crc32.h"
#include "command.h"
#include "jaiabot/messages/power_board/power_board.pb.h"

#define USB_TX_WAIT_TIMEOUT_MS 25
#define MAX_MSG_SIZE 256

extern bool usb_tx_busy;
extern uint8_t bits_in_byte;

void usb_transmit(jaiabot_protobuf_PowerBoardResponse *response);
void usb_receive(void);

#ifdef __cplusplus
}
#endif

#endif // SERIAL_H
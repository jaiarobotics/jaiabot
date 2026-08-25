#ifndef COMMAND_H
#define COMMAND_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>

#include "controls.h"
#include "serial.h"
#include "jaiabot/messages/power_board/power_board.pb.h"

#define POWER_BOARD_CMD_BUF_SIZE 256

// Feeds raw bytes received over the host link (USB CDC) into the COBS frame
// accumulator. Safe to call from the USB RX callback.
void power_board_command_receive(const uint8_t* data, uint32_t len);

// Decodes and dispatches any complete command frame accumulated since the
// last call. Intended to be called from the main loop, not from interrupt
// context, since dispatched commands (e.g. ENTER_BOOTLOADER_MODE) erase flash.
void power_board_command_process(void);

// Sends an immediate command/status response over the host link.
void power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode status_code);

#ifdef __cplusplus
}
#endif

#endif // COMMAND_H
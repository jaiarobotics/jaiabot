#include "command.h"
#include "cobs.h"
#include "crc32.h"
#include "main.h"

#include <pb_decode.h>
#include <string.h>

#define CRC32_SIZE 4
#define BITS_IN_BYTE 8

// Bytes accumulated since the last COBS delimiter (0x00) was seen.
static uint8_t rx_accum[POWER_BOARD_CMD_BUF_SIZE];
static uint16_t rx_accum_len = 0;

// Most recently completed (still COBS-stuffed) frame, awaiting processing
// on the main loop.
static uint8_t pending_frame[POWER_BOARD_CMD_BUF_SIZE];
static uint16_t pending_frame_len = 0;
static volatile bool pending_frame_ready = false;

void power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode status_code)
{
    PowerBoardResponse response = jaiabot_protobuf_PowerBoardResponse_init_zero;
    response.time = (uint64_t)HAL_GetTick() * 1000ULL;
    response.has_status_code = true;
    response.status_code = status_code;
    response.has_motor = true;
    response.motor = controls_get_motor_actual();
    usb_transmit(&response);
}

void power_board_command_receive(const uint8_t* data, uint32_t len)
{
    for (uint32_t i = 0; i < len; ++i)
    {
        if (rx_accum_len < POWER_BOARD_CMD_BUF_SIZE)
        {
            rx_accum[rx_accum_len++] = data[i];
        }
        else
        {
            // Overflowed without seeing a delimiter; drop and resync on the
            // next 0x00.
            rx_accum_len = 0;
            continue;
        }

        if (data[i] == 0)
        {
            if (!pending_frame_ready)
            {
                memcpy(pending_frame, rx_accum, rx_accum_len);
                pending_frame_len = rx_accum_len;
                pending_frame_ready = true;
            }
            rx_accum_len = 0;
        }
    }
}

void power_board_command_process(void)
{
    if (!pending_frame_ready)
    {
        return;
    }

    // pending_frame_len includes the trailing 0x00 COBS delimiter that
    // power_board_command_receive used to detect the end of the frame;
    // COBSUnStuffData expects just the COBS-stuffed bytes themselves, so
    // exclude it here. Use its real return value for the decoded length
    // rather than guessing from trailing zero bytes in the output buffer,
    // which silently undercounts whenever the real data legitimately ends
    // in a zero byte (e.g. a CRC32 with a zero low byte).
    uint8_t decoded_msg[POWER_BOARD_CMD_BUF_SIZE] = {0};
    uint16_t decoded_length =
        (uint16_t)COBSUnStuffData(pending_frame, pending_frame_len - 1, decoded_msg);
    pending_frame_ready = false;

    if (decoded_length < CRC32_SIZE)
    {
        power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode_POWER_BOARD_FRAME_ERROR);
        return;
    }

    uint32_t computed_crc = compute_crc32(decoded_msg, decoded_length - CRC32_SIZE);
    uint32_t provided_crc = 0;
    for (uint8_t i = 0; i < CRC32_SIZE; i++)
    {
        provided_crc |= decoded_msg[decoded_length - CRC32_SIZE + i] << ((CRC32_SIZE - 1U - i) * BITS_IN_BYTE);
    }

    if (computed_crc != provided_crc)
    {
        power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode_POWER_BOARD_CRC_ERROR);
        return;
    }

    jaiabot_protobuf_PowerBoardRequest request = jaiabot_protobuf_PowerBoardRequest_init_zero;
    pb_istream_t istream = pb_istream_from_buffer(decoded_msg, decoded_length - CRC32_SIZE);
    if (!pb_decode(&istream, jaiabot_protobuf_PowerBoardRequest_fields, &request))
    {
        power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode_POWER_BOARD_DECODE_ERROR);
        return;
    }

    bool request_handled = false;

    if (request.has_power_board_mcu_command)
    {
        switch (request.power_board_mcu_command)
        {
            case jaiabot_protobuf_PowerBoardMCUCommand_ENTER_BOOTLOADER_MODE:
                jumpToBootloader();
                break;
            default:
                break;
        }
    }
    
    if (request.data.request_metadata)
    {
        PowerBoardResponse response = jaiabot_protobuf_PowerBoardResponse_init_zero;
        response.time = (uint64_t)HAL_GetTick() * 1000ULL;
        response.which_data = jaiabot_protobuf_PowerBoardResponse_metadata_tag;
        response.data.metadata.has_power_board_version = true;
        response.data.metadata.power_board_version = 1;
        
        usb_transmit(&response);
        request_handled = true;
    }

    if (request.has_control_surfaces)
    {
        handle_control_surfaces(&request.control_surfaces);
        request_handled = true;
    }

    if (request.has_low_power_request)
    {
        power_board_request_low_power_mode_seconds(request.low_power_request.duration_seconds);
        request_handled = true;
    }

    if (request_handled)
    {
        power_board_send_status(jaiabot_protobuf_PowerBoardStatusCode_POWER_BOARD_ACK);
    }
}

#include <string.h>

#include "serial.h"
#include "cobs.h"
#include "usbd_cdc_if.h"

static uint8_t usb_tx_buffer[MAX_MSG_SIZE];
static uint8_t usb_tx_buffer_cobs[MAX_MSG_SIZE];

void usb_transmit(PowerBoardResponse *response)
{
    uint32_t wait_start_tick = HAL_GetTick();
    while (usb_tx_busy)
    {
        if (HAL_GetTick() - wait_start_tick > USB_TX_WAIT_TIMEOUT_MS)
        {
            return;
        }
    }

    uint8_t *buffer = usb_tx_buffer;
    uint8_t *buffer_cobs = usb_tx_buffer_cobs;
    size_t message_length;

    pb_ostream_t stream = pb_ostream_from_buffer(buffer, MAX_MSG_SIZE);

    bool status = pb_encode(&stream, jaiabot_protobuf_PowerBoardResponse_fields, response);

    if (!status)
    {
        return;
    }

    message_length = stream.bytes_written;

    uint32_t calculated_crc32 = compute_crc32(buffer, message_length);

    uint8_t counter = 0;
    for (int i = bytes_in_crc32 - 1; i >= 0; --i)
    {
        buffer[counter + message_length] = (calculated_crc32 >> (i * bits_in_byte)) & 0xFF;
        counter++;
    }

    memset(buffer_cobs, 0 , MAX_MSG_SIZE);
    COBSStuffData(buffer, message_length + bytes_in_crc32, buffer_cobs);

    uint8_t len_cobs = {0};
    for (int i = 0; i < MAX_MSG_SIZE; i++) 
    {
        len_cobs = len_cobs + 1;
        if (buffer_cobs[i] == 0) 
        {
            break;
        }
    }

    uint8_t tx_status = USBD_BUSY;
    uint32_t tx_start = HAL_GetTick();

    while (tx_status == USBD_BUSY && (HAL_GetTick() - tx_start) < 100U)
    {
       tx_status = CDC_Transmit_FS(usb_tx_buffer_cobs, len_cobs);
    }
}

void usb_receive()
{
}
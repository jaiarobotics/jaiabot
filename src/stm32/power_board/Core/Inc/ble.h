#ifndef BLE_H
#define BLE_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>

#include "crc32.h"

typedef enum {
    BLE_STATE_DISCONNECTED = 0,
    BLE_STATE_CONNECTING,
    BLE_STATE_CONNECTED,
    BLE_STATE_ERROR,
} BLE_State;

typedef struct {
    BLE_State state;
    bool enabled;
    uint8_t device_address[6];
} BLE_HandleTypeDef;

void ble_init(void);
void ble_connect(void);
void ble_disconnect(void);
void ble_transmit(void);
void ble_receive(void);
bool ble_start_advertising(void);
bool ble_stop_advertising(void);
bool ble_is_connected(void);
BLE_State ble_get_state(void);
void ble_process(void);

#ifdef __cplusplus
}
#endif

#endif // BLE_H

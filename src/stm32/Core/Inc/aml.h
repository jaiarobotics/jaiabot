#ifndef JAIABOT_AML_H
#define JAIABOT_AML_H

#include <stdbool.h>
#include <stdint.h>

/**
 * @brief Called from HAL_UARTEx_RxEventCallback when USART1 receives data.
 *        Copies the raw UART buffer into a snapshot for processing.
 *
 * @param buf  Pointer to the received data buffer
 * @param size Number of bytes received
 */
void AML_UART_RxCallback(const uint8_t *buf, uint16_t size);

/**
 * @brief Parses the latest AML snapshot and transmits a SensorData message.
 *        Should be called from the main loop at the configured sample rate.
 *        No-ops if no new data has arrived since the last call.
 */
void transmit_aml_data(void);

void AML_Reset(void);

#endif // JAIABOT_AML_H
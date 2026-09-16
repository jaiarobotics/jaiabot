/*
 * command.h
 *
 *  Created on: Mar 5, 2025
 *      Author: ColinVincent
 */

#ifndef INC_COMMAND_H_
#define INC_COMMAND_H_

#include "stdint.h"
#include "crc32.h"
#include "stdio.h"
#include "string.h"
#include "stdbool.h"

#include "jaiabot/messages/sensor/sensor_core.pb.h"

#define UART_QUEUE_SIZE 32
#define UART_MAX_LEN 256

typedef jaiabot_sensor_protobuf_SensorRequest SensorRequest;

// Single-producer / single-consumer ring buffer. wIndex is written only by the
// USART2 RX ISR (HAL_UARTEx_RxEventCallback), rIndex only by process_cmd() in
// the main loop, so neither side needs to disable interrupts: each index has
// exactly one writer and is published with a single aligned 8-bit store. The
// queue is empty when rIndex == wIndex and full when advancing wIndex would
// reach rIndex, which costs one slot (UART_QUEUE_SIZE - 1 usable).
typedef struct tUartQueue
{
  uint8_t msgQueue[UART_QUEUE_SIZE][UART_MAX_LEN];        // {msg1,msg2,msg3...,msg128} length * width
  volatile uint8_t wIndex;
  volatile uint8_t rIndex;
} UART_QUEUE;

// Advance a ring index, wrapping at the end of the queue.
#define UART_QUEUE_NEXT(index) (((index) + 1u) % UART_QUEUE_SIZE)

// Compiler-only barrier. A single-core Cortex-M needs no data barrier between
// the main loop and an ISR, but the slot contents must not be reordered across
// the store/load of the index that publishes them.
#define UART_QUEUE_BARRIER() __asm volatile("" ::: "memory")

extern UART_QUEUE uQueue;

SensorRequest process_cmd(void);

#endif /* INC_COMMAND_H_ */

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

// Lock-free SPSC ring: only the USART2 RX ISR writes wIndex, only process_cmd() writes rIndex.
// Empty when rIndex == wIndex; one slot is sacrificed to tell full from empty.
typedef struct tUartQueue
{
  uint8_t msgQueue[UART_QUEUE_SIZE][UART_MAX_LEN];        // {msg1,msg2,msg3...,msg128} length * width
  volatile uint8_t wIndex;
  volatile uint8_t rIndex;
} UART_QUEUE;

// Advance a ring index, wrapping at the end of the queue.
#define UART_QUEUE_NEXT(index) (((index) + 1u) % UART_QUEUE_SIZE)

// Compiler-only barrier (enough on single-core Cortex-M) so slot contents aren't
// reordered across the index store/load that publishes them.
#define UART_QUEUE_BARRIER() __asm volatile("" ::: "memory")

extern UART_QUEUE uQueue;

SensorRequest process_cmd(void);

#endif /* INC_COMMAND_H_ */

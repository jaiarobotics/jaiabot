#ifndef BLUETOOTH_LE_H
#define BLUETOOTH_LE_H

#include "main.h"
#include "stm32l4xx_hal.h"
#include <string.h>
#include <stdio.h>

int BLE_test();

extern UART_HandleTypeDef huart2;

struct BLE_Data{
    char recStartBLE[100];
    char recStatusBLE[100];
};

#endif
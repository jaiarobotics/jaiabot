#include "bluetoothLE.h"

struct BLE_Data dataBLE;

char startBLE[] = "AT+UMSM";
char statusBLE[] = "AT+UMSTAT";

int BLE_test(){
    HAL_UART_Transmit(&huart2, (uint8_t *)startBLE, sizeof(startBLE), HAL_MAX_DELAY);
    if (HAL_UART_Receive(&huart2, (uint8_t *)dataBLE.recStartBLE, sizeof(dataBLE.recStartBLE), HAL_MAX_DELAY) != HAL_OK){
      return 1;
    }
    #ifdef VERBOSE_TEST_OUTPUT
      printf(dataBLE.recStartBLE);
      printf("\n");
    #endif

    HAL_UART_Transmit(&huart2, (uint8_t *)statusBLE, sizeof(statusBLE), HAL_MAX_DELAY);
    if (HAL_UART_Receive(&huart2, (uint8_t *)dataBLE.recStatusBLE, sizeof(dataBLE.recStatusBLE), HAL_MAX_DELAY) != HAL_OK){
      return 2;
    }
    #ifdef VERBOSE_TEST_OUTPUT
      printf(dataBLE.recStatusBLE);
      printf("\n");
    #endif
    
    return 0;
}
#include "rtc3231m.h"
#include "stm32l4xx_hal.h"
#include "stm32l4xx_hal_i2c.h"

struct rtcRegData regData;

//Main test for the RTC. Sets time, reads it back after 1 second, and compares the new values to the set values. Writes values to serial if VERBOSE_TEST_OUTPUT is defined.
int rtc_test(){
  // switch (updateRegisters()){
  //   case 0: ;; break;
  //   case 1: return 1; break;
  //   case 2: return 2; break;
  //   case 3: return 3; break;
  //   case 4: return 4; break;
  // }

  if(Set_Time(7, 11, 12, 1, 2, 4, 26)) return 2;

  HAL_Delay(1000);

  if (Get_Time()) return 3;

  #ifdef VERBOSE_TEST_OUTPUT
    printf("RTC_SECOND: %d\n", regData.second);
    printf("RTC_MINUTE: %d\n", regData.minute);
    printf("RTC_HOUR: %d\n", regData.hour);
    printf("RTC_DAY: %d\n", regData.day);
    // printf("RTC_DOW: %d\n", regData.date);
    printf("RTC_MONTH: %d\n", regData.month);
    printf("RTC_YEAR: %d\n", regData.year);
  #endif

  if(regData.second != 8){
    return 1;
  }
  if(regData.minute != 11){
    return 1;
  }
  if(regData.hour != 12){
    return 1;
  }
  if(regData.day != 1){
    return 1;
  }
  if(regData.date != 2){
    return 1;
  }
  if(regData.month != 4){
    return 1;
  }
  if(regData.year != 26){
    return 1;
  }

  return 0;
}

// Convert normal decimal numbers to binary coded decimal
uint8_t decToBcd(int val){
  return (uint8_t)( (val/10*16) + (val%10) );
}
// Convert binary coded decimal to normal decimal numbers
int bcdToDec(uint8_t val){
  return (int)( (val/16*10) + (val%16) );
}

//Sets the time of the RTC using the set_time list defined in the function and writen to when calling the function.
int Set_Time(uint8_t sec, uint8_t min, uint8_t hour, uint8_t dow, uint8_t dom, uint8_t month, uint8_t year){
	uint8_t set_time[7];
	set_time[0] = decToBcd(sec);
	set_time[1] = decToBcd(min);
	set_time[2] = decToBcd(hour);
	set_time[3] = decToBcd(dow);
	set_time[4] = decToBcd(dom);
	set_time[5] = decToBcd(month);
	set_time[6] = decToBcd(year);

	HAL_I2C_Mem_Write(&hi2c1, rtcSlaveAddr, rtcSecondAddr, 1, set_time, 7, 1000);

  return 0;
}

//Obtain time data (second, minute, hour, day, data, month, year) from RTC, and store it in regData struct (defined in .h file)
int Get_Time(void){
	uint8_t timeData[7];
	HAL_I2C_Mem_Read(&hi2c1, rtcSlaveAddr, rtcSecondAddr, 1, timeData, 7, 1000);
	regData.second = bcdToDec(timeData[0]);
	regData.minute = bcdToDec(timeData[1]);
	regData.hour = bcdToDec(timeData[2]);
	regData.day = bcdToDec(timeData[3]);
	regData.date = bcdToDec(timeData[4]);
	regData.month = bcdToDec(timeData[5]);
	regData.year = bcdToDec(timeData[6]);

  return 0;
}

//Obtain RTC temperature from IC, Not used due to accuracy / calibration issues
// float Get_Temp(void){
// 	uint8_t temp[2];
// 	HAL_I2C_Mem_Read(&hi2c1, rtcSlaveAddr, rtcTempMSB, 1, temp, 2, 1000);
//   uint16_t test = temp[0];
//   test = test << 2;
//   test = test + (uint16_t)temp[1];
//   printf("%d\n", test/4);
//   float retVal = (temp[0] + (temp[1] >> 6)) / 4.0;
// 	return retVal;
// }

//tell the RTC to measure temperature on the IC.
int force_temp_conv(void){
	uint8_t status=0;
	uint8_t control=0;
	HAL_I2C_Mem_Read(&hi2c1, rtcSlaveAddr, rtcStatusAddr, 1, &status, 1, 100);  // read status register
	if (!(status&0x04)){  // if the BSY bit is not set
		HAL_I2C_Mem_Read(&hi2c1, rtcSlaveAddr, rtcCTRLAddr, 1, &control, 1, 100);  // read control register
		HAL_I2C_Mem_Write(&hi2c1, rtcSlaveAddr, rtcCTRLAddr, 1, (uint8_t *)(control|(0x20)), 1, 100);  // write modified control register with CONV bit as'1'
	}

  return 0;
}


//Unused code maybe for future implimentation

// int rtcWriteCommand(I2C_HandleTypeDef *port, uint16_t slaveAddr, uint16_t regAddr, uint8_t *data){
//   if (HAL_I2C_Mem_Write(port, slaveAddr, regAddr, sizeof(regAddr), data, 1, HAL_MAX_DELAY) != HAL_OK) {
//     return 1;
//   }
//   return 0;
// }

// int rtcReadCommand(I2C_HandleTypeDef *port, uint16_t slaveAddr, uint16_t regAddr, uint8_t *data){
//   if (HAL_I2C_Mem_Read(port, slaveAddr, regAddr, sizeof(regAddr), data, 1, HAL_MAX_DELAY) != HAL_OK) {
//     return 1;
//   }
//   return 0;
// }

// int updateRegisters(){
//   #ifdef VERBOSE_TEST_OUTPUT
//     printf("reading RTC time data\n");
//   #endif
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcSecondAddr, &regData.second)) return 1;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcMinuteAddr, &regData.minute)) return 1;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcHourAddr, &regData.hour)) return 1;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcDayAddr, &regData.day)) return 1;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcDateAddr, &regData.date)) return 1;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcMonthAddr, &regData.month)) return 1;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcYearAddr, &regData.year)) return 1;

//   #ifdef VERBOSE_TEST_OUTPUT
//     printf("reading RTC alarm1 data\n");
//   #endif
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmOneSecondAddr, &regData.almOneSecond)) return 2;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmOneMinuteAddr, &regData.almOneMinute)) return 2;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmOneHourAddr, &regData.almOneHour)) return 2;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmOneDayDateAddr, &regData.almOneDayDate)) return 2;

//   #ifdef VERBOSE_TEST_OUTPUT
//     printf("reading RTC alarm2 data\n");
//   #endif
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmTwoMinutesAddr, &regData.almTwoMinute)) return 3;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmTwoHourAddr, &regData.almTwoHour)) return 3;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAlmTwoDayDateAddr, &regData.almTwoDayDate)) return 3;

//   #ifdef VERBOSE_TEST_OUTPUT
//     printf("reading RTC control data\n");
//   #endif
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcCTRLAddr, &regData.regCTRL)) return 4;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcStatusAddr, &regData.regStatus)) return 4;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcAgingOffset, &regData.agingOffset)) return 4;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcTempMSB, &regData.tempMSB)) return 4;
//   if(rtcReadCommand(&hi2c1, rtcSlaveAddr, rtcTempLSB, &regData.tempLSB)) return 4;

//   #ifdef VERBOSE_TEST_OUTPUT
//     printf("%x\n", regData.second);
//     printf("%x\n", regData.minute);
//     printf("%x\n", regData.hour);
//     printf("%x\n", regData.day);
//     printf("%x\n", regData.date);
//     printf("%x\n", regData.month);
//     printf("%x\n", regData.year);

//     printf("%x\n", regData.regCTRL);
//     printf("%x\n", regData.regStatus);
//     printf("%x\n", regData.agingOffset);
//     printf("%x\n", regData.tempMSB);
//     printf("%x\n", regData.tempLSB);
//   #endif

//   return 0;
// }
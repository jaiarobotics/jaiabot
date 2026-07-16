#ifndef RTC_3231M_H
#define RTC_3231M_H

#include "main.h"
#include "stm32l4xx_hal.h"
#include <string.h>
#include <stdio.h>

#define rtcSlaveAddr            0xD0

#define rtcSecondAddr           0x00
#define rtcMinuteAddr           0x01
#define rtcHourAddr             0x02
#define rtcDayAddr              0x03
#define rtcDateAddr             0x04
#define rtcMonthAddr            0x05
#define rtcYearAddr             0x06

#define rtcAlmOneSecondAddr     0x07
#define rtcAlmOneMinuteAddr     0x08
#define rtcAlmOneHourAddr       0x09
#define rtcAlmOneDayDateAddr    0x0A

#define rtcAlmTwoMinutesAddr    0x0B
#define rtcAlmTwoHourAddr       0x0C
#define rtcAlmTwoDayDateAddr    0x0D

#define rtcCTRLAddr             0x0E
#define rtcStatusAddr           0x0F
#define rtcAgingOffset          0x10
#define rtcTempMSB              0x11
#define rtcTempLSB              0x12

int rtc_test();
uint8_t decToBcd(int val);
int bcdToDec(uint8_t val);
int Set_Time(uint8_t sec, uint8_t min, uint8_t hour, uint8_t dow, uint8_t dom, uint8_t month, uint8_t year);
int Get_Time(void);
// float Get_Temp(void);
int force_temp_conv(void);
// int rtcWriteCommand(I2C_HandleTypeDef *port, uint16_t slaveAddr, uint16_t regAddr, uint8_t *data);
// int rtcReadCommand(I2C_HandleTypeDef *port, uint16_t slaveAddr, uint16_t regAddr, uint8_t *data);
// int updateRegisters();

struct rtcRegData {
    uint8_t second;
    uint8_t minute;
    uint8_t hour;
    uint8_t day;
    uint8_t date;
    uint8_t month;
    uint8_t year;

    uint8_t almOneSecond;
    uint8_t almOneMinute;
    uint8_t almOneHour;
    uint8_t almOneDayDate;

    uint8_t almTwoMinute;
    uint8_t almTwoHour;
    uint8_t almTwoDayDate;

    uint8_t regCTRL;
    uint8_t regStatus;
    uint8_t agingOffset;
    uint8_t tempMSB;
    uint8_t tempLSB;
};

extern I2C_HandleTypeDef hi2c1;

#endif
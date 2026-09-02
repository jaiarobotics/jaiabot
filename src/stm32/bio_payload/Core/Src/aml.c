#include "aml.h"

#include <stdlib.h>
#include <string.h>

#include "main.h"


// TYPE DEF //
typedef jaiabot_sensor_protobuf_SensorData SensorData;
typedef jaiabot_sensor_protobuf_AML AmlData;

typedef enum
{
    DEFAULT = 0,
    CONDUCTIVITY,
    SOUND_VELOCITY,
} AML_SensorType;


// GLOBALS //
static volatile bool data_ready = false;
static uint8_t aml_buffers[2][MAX_MSG_SIZE] = {{0}, {0}};
static volatile uint8_t write_idx = 0;
static AML_SensorType sensor_type = DEFAULT;

extern void transmit_sensor_data(SensorData *sensor_data);
extern int Sensors[];


// FUNCTION DEFINITIONS //
void AML_Reset(void)
{
    sensor_type = DEFAULT;
    data_ready  = false;
    write_idx   = 0;
    memset(aml_buffers, 0, sizeof(aml_buffers));
}

/**
 * @brief Processes a metadata line (beginning with '@') to determine sensor type.
 *        Called during the initial sensor burst before data lines arrive.
 *
 * @param line  Null-terminated metadata line from the sensor
 */
 static void AML_ProcessMetadata(const char *line)
 {
    if (strstr(line, "conductivity") != NULL)
    {
      sensor_type = CONDUCTIVITY;
    }
    else if (strstr(line, "SVT") != NULL)
    { 
      sensor_type = SOUND_VELOCITY;
    }
    else
    {
      sensor_type = DEFAULT;
    }
 }

/**
 * @brief Parses the raw ASCII snapshot from an AML CT probe AML protobuf message.
 *        Expected format: " <conductivity> <temperature>"
 *
 * @param[out] out  Pointer to the AML message to populate
 * @return true if both fields were successfully parsed, false otherwise
 */
 static bool aml_parse_ct(const char *buf, AmlData *out)
 {
     // Parse the buffer until we find a non-whitespace (first word). Move ptr there.
     const char *ptr = buf;
     while (*ptr == ' ' || *ptr == '\t') ptr++;
 
     // Save the first word to conductivity. 
     // Move ptr to the end of this word.
     char *endptr;
     double conductivity = strtod(ptr, &endptr);
     if (endptr == ptr) return false;
 
     // Parse the buffer until we find a non-whitespace (second word). Move ptr there.
     ptr = endptr;
     while (*ptr == ' ' || *ptr == '\t') ptr++;
 
     // Save the second word to temperature.
     // Move ptr to the end of this word. 
     double temperature = strtod(ptr, &endptr);
     if (endptr == ptr) return false;
 
     // Setup our output message
     out->has_sensor       = true;
     out->sensor           = jaiabot_sensor_protobuf_AML_Sensor_CONDUCTIVITY;
     out->has_conductivity = true;
     out->conductivity     = conductivity;
     out->has_temperature  = true;
     out->temperature      = temperature;
 
     return true;
 }

static bool AML_Parse(const char *buf, AmlData *out)
{
  switch (sensor_type)
  {
    case CONDUCTIVITY:
      return aml_parse_ct(buf, out);
    case DEFAULT:
      return aml_parse_ct(buf, out);
    default:
      return false;
  }

}

void AML_UART_RxCallback(const uint8_t *buf, uint16_t size)
{
    if (size == 0 || size >= MAX_MSG_SIZE) return;

    uint8_t *dst = aml_buffers[write_idx];
    memcpy(dst, buf, size);
    dst[size] = '\0';

    int len = (int)size;
    while (len > 0 && (dst[len - 1] == '\r' || dst[len - 1] == '\n'))
        dst[--len] = '\0';

    if (dst[0] == '@')
    {
        AML_ProcessMetadata((const char *)dst);
        return;  // Don't swap or set data_ready for metadata lines
    }

    write_idx ^= 1;  // Swap so parser reads completed buffer
    data_ready = true;
}

void transmit_aml_data(void)
{
    if (!data_ready)
    {
      return;
    }
    
    data_ready = false;

    // Read from whichever buffer UART is NOT writing to
    const char *parse_buf = (const char *)aml_buffers[write_idx ^ 1];

    AmlData aml = jaiabot_sensor_protobuf_AML_init_zero;

    if (!AML_Parse(parse_buf, &aml))
    {
        return;
    }

    SensorData sensor_data = jaiabot_sensor_protobuf_SensorData_init_zero;
    sensor_data.time       = HAL_GetTick();
    sensor_data.which_data = jaiabot_sensor_protobuf_SensorData_aml_tag;
    sensor_data.data.aml   = aml;

    transmit_sensor_data(&sensor_data);
}
/*
 * crc32.h
 *
 *  Created on: Mar 11, 2025
 *      Author: MatthewFerro
 */

#ifndef INC_CRC32_H_
#define INC_CRC32_H_

#include <stdint.h>
#include <stddef.h>

// Function to initialize CRC32 table
void init_crc32_table(void);

// Computes CRC32 for given data buffer
uint32_t compute_crc32(const uint8_t* data, size_t length);

#endif /* INC_CRC32_H_ */

#include <stdint.h>
#include <stdlib.h>

/// @brief Calculate the Fletcher-16 checksum of a block of data.
/// @param input_str Pointer to the start of the data block.
/// @param num_bytes Length of the data block, in bytes.
/// @return
/// @note The Fletcher checksum is an algorithm for computing a position-dependent checksum devised by John G. Fletcher (1934–2012) at Lawrence Livermore Labs in the late 1970s.[1] The objective of the Fletcher checksum was to provide error-detection properties approaching those of a cyclic redundancy check but with the lower computational effort associated with summation techniques.
uint16_t fletcher16(const void* input_str, size_t num_bytes)
{
    uint16_t sum = 0;
    uint8_t* sum1 = (uint8_t*)&sum;
    uint8_t* sum2 = sum1 + 1;

    const uint8_t* buf = (uint8_t*)input_str;

    for (int i = 0; i < num_bytes; i++)
    {
        (*sum1) += buf[i];
        (*sum2) += (*sum1);
    }

    return sum;
}

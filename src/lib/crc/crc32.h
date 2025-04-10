
#ifndef JAIABOT_CORE_SRC_LIB_CRC_CRC32_H
#define JAIABOT_CORE_SRC_LIB_CRC_CRC32_H

#include <stdint.h>
#include <stdlib.h>

using namespace std;

namespace crc
{
class CRC32Table
{
  public:
    uint32_t table[256];

    CRC32Table() { generate_table(); }

    void generate_table()
    {
        uint32_t polynomial = 0xEDB88320;
        for (uint32_t i = 0; i < 256; i++)
        {
            uint32_t c = i;
            for (size_t j = 0; j < 8; j++)
            {
                if (c & 1)
                {
                    c = polynomial ^ (c >> 1);
                }
                else
                {
                    c >>= 1;
                }
            }
            table[i] = c;
        }
    }
};

const CRC32Table crc32_table;

uint32_t calculate_crc32(const void* buf, size_t len, uint32_t initial = 0)
{
    const uint32_t* table = crc32_table.table;

    uint32_t c = initial ^ 0xFFFFFFFF;
    const uint8_t* u = static_cast<const uint8_t*>(buf);
    for (size_t i = 0; i < len; ++i) { c = table[(c ^ u[i]) & 0xFF] ^ (c >> 8); }
    return c ^ 0xFFFFFFFF;
}
}; // namespace crc

#endif

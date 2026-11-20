#ifndef JAIABOT_SRC_LIB_COMMS_DCCL_TIME_H
#define JAIABOT_SRC_LIB_COMMS_DCCL_TIME_H

#include <cstdint>

namespace jaiabot
{
namespace comms
{
/// \brief Rounds a timestamp to the dccl.time resolution (default 1 second), as it arrives after a DCCL round trip
inline std::uint64_t dccl_time2_round(std::uint64_t ts_micros,
                                      std::uint64_t resolution_micros = 1000000ULL)
{
    return ((ts_micros + resolution_micros / 2) / resolution_micros) * resolution_micros;
}

} // namespace comms
} // namespace jaiabot

#endif

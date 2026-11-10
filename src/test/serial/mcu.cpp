#define BOOST_TEST_MODULE jaiabot_test_serial_mcu
#include <boost/test/included/unit_test.hpp>

#include <dccl/binary.h>

#include "jaiabot/messages/storm_mcu.pb.h"
#include "jaiabot/serial/mcu.h"

BOOST_AUTO_TEST_SUITE(SerialMCUTestSuite)

BOOST_AUTO_TEST_CASE(StormMCURequestRoundtrip)
{
    using jaiabot::protobuf::StormMCURequest;

    StormMCURequest request;
    request.set_type(StormMCURequest::AIR_DESCENT_DATA_REQUEST);
    auto io_msg = jaiabot::serial::encode_for_mcu(request);
    auto request_dec = jaiabot::serial::decode_from_mcu<StormMCURequest>(*io_msg);

    BOOST_REQUIRE(request.SerializeAsString() == request_dec.SerializeAsString());
}

BOOST_AUTO_TEST_CASE(StormMCUResponseRoundtrip)
{
    using jaiabot::protobuf::StormMCUResponse;

    StormMCUResponse response;
    auto& data = *response.mutable_air_descent_data();
    data.set_packet_index(0);

    for (int i = 0, n = 100; i < n; ++i) data.add_sample()->set_temperature(-70 + i);

    auto io_msg = jaiabot::serial::encode_for_mcu(response);
    auto response_dec = jaiabot::serial::decode_from_mcu<StormMCUResponse>(*io_msg);

    BOOST_REQUIRE(response.SerializeAsString() == response_dec.SerializeAsString());
}

BOOST_AUTO_TEST_SUITE_END()

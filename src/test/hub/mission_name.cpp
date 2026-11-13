#define BOOST_TEST_MODULE jaiabot_test_hub_mission_name
#include <boost/test/included/unit_test.hpp>

#include <dccl/codec.h>

#include "jaiabot/hub/mission_name.h"

namespace jaiabot
{
namespace hub
{
std::size_t max_bytes(const google::protobuf::Descriptor* descriptor)
{
    return descriptor->FindFieldByName("mission_name")
        ->options()
        .GetExtension(dccl::field)
        .max_length();
}

const std::size_t limit = max_bytes(protobuf::Hub2HubData::descriptor());

BOOST_AUTO_TEST_CASE(both_hub2hub_messages_share_the_limit)
{
    BOOST_CHECK_EQUAL(limit, max_bytes(protobuf::Hub2HubActiveMission::descriptor()));
}

BOOST_AUTO_TEST_CASE(name_that_fits_is_unchanged)
{
    const std::string name(limit, 'n');
    BOOST_CHECK_EQUAL(fit_mission_name(name), name);
}

BOOST_AUTO_TEST_CASE(long_name_is_cut_to_the_limit)
{
    BOOST_CHECK_EQUAL(fit_mission_name(std::string(limit + 5, 'n')), std::string(limit, 'n'));
}

BOOST_AUTO_TEST_CASE(cut_never_splits_a_character)
{
    // "é" is 2 bytes: after "n", the last one that fits ends one byte short of the limit
    std::string accented = "n";
    while (accented.size() + 2 <= limit) accented += "é";
    BOOST_CHECK_EQUAL(fit_mission_name(accented + "é"), accented);

    // the wave emoji is 4 bytes and only 3 are left

    const std::string ascii(limit - 3, 'n');
    BOOST_CHECK_EQUAL(fit_mission_name(ascii + "\xF0\x9F\x8C\x8A"), ascii);
}

BOOST_AUTO_TEST_CASE(fitted_name_round_trips_through_strict_dccl)
{
    dccl::Codec codec;
    codec.set_strict(true);
    codec.load<protobuf::Hub2HubData>();

    std::string accented;
    while (accented.size() < limit + 10) accented += "é";

    protobuf::Hub2HubData hub2hub_data;
    hub2hub_data.set_hub_id(1);
    hub2hub_data.set_time(1000000);
    hub2hub_data.set_mission_name(fit_mission_name(accented));

    std::string bytes;
    BOOST_REQUIRE_NO_THROW(codec.encode(&bytes, hub2hub_data));
    protobuf::Hub2HubData received;
    codec.decode(bytes, &received);
    BOOST_CHECK_EQUAL(received.mission_name(), hub2hub_data.mission_name());
}

} // namespace hub
} // namespace jaiabot

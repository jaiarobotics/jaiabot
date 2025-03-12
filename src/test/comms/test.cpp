#define BOOST_TEST_MODULE jaiabot_test_comms_conversions
#include "jaiabot/comms/comms.h"
#include <boost/test/included/unit_test.hpp>

namespace jaiabot
{
namespace comms
{

constexpr int subnet_mask = 0xFF00;

BOOST_AUTO_TEST_SUITE(modem_id_conversion_tests)

BOOST_AUTO_TEST_CASE(test_modem_id_from_bot_id)
{
    for (int l = 0, n = jaiabot::protobuf::Link_MAX; l <= n; ++l)
    {
        auto link = static_cast<jaiabot::protobuf::Link>(l);

        int num_modems_in_subnet = 256;

        BOOST_CHECK_EQUAL(modem_id_from_bot_id(bot_id_min, subnet_mask, link),
                          bot0_base_modem_id + num_modems_in_subnet * l);
        BOOST_CHECK_EQUAL(modem_id_from_bot_id(0, subnet_mask, link),
                          bot0_base_modem_id + num_modems_in_subnet * l);
        BOOST_CHECK_EQUAL(modem_id_from_bot_id(15, subnet_mask, link),
                          17 + num_modems_in_subnet * l);
        BOOST_CHECK_THROW(modem_id_from_bot_id(bot_id_min - 1, subnet_mask, link),
                          jaiabot::Exception);
        BOOST_CHECK_THROW(modem_id_from_bot_id(bot_id_max + 1, subnet_mask, link),
                          jaiabot::Exception);
    }
}

BOOST_AUTO_TEST_CASE(test_bot_id_from_modem_id)
{
    BOOST_CHECK_EQUAL(bot_id_from_modem_id(bot0_base_modem_id, subnet_mask), bot_id_min);
    BOOST_CHECK_EQUAL(bot_id_from_modem_id(17, subnet_mask), 15);
    BOOST_CHECK_EQUAL(bot_id_from_modem_id(273, subnet_mask), 15);
    BOOST_CHECK_EQUAL(bot_id_from_modem_id(259, subnet_mask), 1);
    BOOST_CHECK_THROW(bot_id_from_modem_id(bot0_base_modem_id - 1, subnet_mask),
                      jaiabot::Exception);
    BOOST_CHECK_THROW(bot_id_from_modem_id(bot0_base_modem_id + bot_id_max + 1, subnet_mask),
                      jaiabot::Exception);
}

BOOST_AUTO_TEST_CASE(test_bot_id_and_modem_id_conversion_consistency)
{
    for (int l = 0, n = jaiabot::protobuf::Link_MAX; l <= n; ++l)
    {
        auto link = static_cast<jaiabot::protobuf::Link>(l);
        std::cout << "Testing link: " << jaiabot::protobuf::Link_Name(link) << std::endl;
        for (int bot_id = bot_id_min; bot_id <= bot_id_max; ++bot_id)
        {
            int modem_id = modem_id_from_bot_id(bot_id, subnet_mask, link);
            BOOST_CHECK_EQUAL(bot_id_from_modem_id(modem_id, subnet_mask), bot_id);
        }
    }
}

BOOST_AUTO_TEST_CASE(test_bot_id_bounds)
{
    BOOST_CHECK_NO_THROW(check_bot_id_bounds(bot_id_min));
    BOOST_CHECK_NO_THROW(check_bot_id_bounds(bot_id_max));
    BOOST_CHECK_THROW(check_bot_id_bounds(bot_id_min - 1), jaiabot::Exception);
    BOOST_CHECK_THROW(check_bot_id_bounds(bot_id_max + 1), jaiabot::Exception);
}

BOOST_AUTO_TEST_CASE(test_link_from_modem_id)
{
    BOOST_CHECK_EQUAL(link_from_modem_id(1, subnet_mask), jaiabot::protobuf::LINK_XBEE);
    BOOST_CHECK_EQUAL(link_from_modem_id(10, subnet_mask), jaiabot::protobuf::LINK_XBEE);
    BOOST_CHECK_EQUAL(link_from_modem_id(259, subnet_mask), jaiabot::protobuf::LINK_WIFI);
    BOOST_CHECK_EQUAL(link_from_modem_id(273, subnet_mask), jaiabot::protobuf::LINK_WIFI);

    BOOST_CHECK_EQUAL(link_from_modem_id(5000, subnet_mask), jaiabot::protobuf::LINK_UNKNOWN);
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace comms
} // namespace jaiabot

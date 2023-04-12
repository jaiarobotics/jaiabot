#define BOOST_TEST_MODULE jaiabot_test_comms_conversions
#include "jaiabot/comms/comms.h"
#include <boost/test/included/unit_test.hpp>

namespace jaiabot
{
namespace comms
{
BOOST_AUTO_TEST_SUITE(modem_id_conversion_tests)

BOOST_AUTO_TEST_CASE(test_modem_id_from_bot_id)
{
    BOOST_CHECK_EQUAL(modem_id_from_bot_id(bot_id_min), bot0_modem_id);
    BOOST_CHECK_EQUAL(modem_id_from_bot_id(0), bot0_modem_id);
    BOOST_CHECK_EQUAL(modem_id_from_bot_id(15), 17);
    BOOST_CHECK_THROW(modem_id_from_bot_id(bot_id_min - 1), jaiabot::Exception);
    BOOST_CHECK_THROW(modem_id_from_bot_id(bot_id_max + 1), jaiabot::Exception);
}

BOOST_AUTO_TEST_CASE(test_bot_id_from_modem_id)
{
    BOOST_CHECK_EQUAL(bot_id_from_modem_id(bot0_modem_id), bot_id_min);
    BOOST_CHECK_EQUAL(bot_id_from_modem_id(17), 15);
    BOOST_CHECK_THROW(bot_id_from_modem_id(bot0_modem_id - 1), jaiabot::Exception);
    BOOST_CHECK_THROW(bot_id_from_modem_id(bot0_modem_id + bot_id_max + 1), jaiabot::Exception);
}

BOOST_AUTO_TEST_CASE(test_bot_id_and_modem_id_conversion_consistency)
{
    for (int bot_id = bot_id_min; bot_id <= bot_id_max; ++bot_id)
    {
        int modem_id = modem_id_from_bot_id(bot_id);
        BOOST_CHECK_EQUAL(bot_id_from_modem_id(modem_id), bot_id);
    }
}

BOOST_AUTO_TEST_CASE(test_bot_id_bounds)
{
    BOOST_CHECK_NO_THROW(check_bot_id_bounds(bot_id_min));
    BOOST_CHECK_NO_THROW(check_bot_id_bounds(bot_id_max));
    BOOST_CHECK_THROW(check_bot_id_bounds(bot_id_min - 1), jaiabot::Exception);
    BOOST_CHECK_THROW(check_bot_id_bounds(bot_id_max + 1), jaiabot::Exception);
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace comms
} // namespace jaiabot

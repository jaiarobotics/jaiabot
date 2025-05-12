#define BOOST_TEST_MODULE jaiabot_test_utils
#include "jaiabot/utils/specific_conductivity.h"
#include <boost/test/included/unit_test.hpp>

namespace jaiabot
{
namespace utils
{
BOOST_AUTO_TEST_SUITE(utils_tests)

BOOST_AUTO_TEST_CASE(test_conductivity)
{
    struct TestData
    {
        double measured_conductivity;
        double temperature;
        double expected_specific_conductivity;
    };

    const TestData tests[] = {
        {717, 5, 1413}, {868, 10, 1413}, {1033, 15, 1413}, {1217, 20, 1413}, {1413, 25,1413}, {1626, 30, 1413}, {1851, 35, 1413}, 
        {8210, 5, 12880}, {9340, 10, 12880}, {10500, 15, 12880}, {11670, 20, 12880}, {12880, 25, 12880}, {14140, 30, 12880}, {15420, 35, 12880},
        // Need to find 80,000 uS/cm value
 };

    for (auto test : tests)
    {
        const double specific_conductivity = calculate_specific_conductivity(test.measured_conductivity, test.temperature);
        BOOST_CHECK_CLOSE(specific_conductivity, test.expected_specific_conductivity, 2);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot
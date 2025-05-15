#define BOOST_TEST_MODULE jaiabot_test_utils
#include "jaiabot/utils/derived_salinity.h"
#include "jaiabot/utils/specific_conductivity.h"
#include <boost/test/included/unit_test.hpp>

namespace jaiabot
{
namespace utils
{
BOOST_AUTO_TEST_SUITE(utils_tests)

BOOST_AUTO_TEST_CASE(test_derived_salinity)
{
    struct TestData
    {
        double R, t, p, S;
    };

    const TestData tests[] = {
        {1.0, 15.0, 0.0, 35.0}, {1.2, 20.0, 2000.0, 37.245628}, {0.65, 5.0, 1500.0, 27.995347}};

    const double standard_conductivity = 42914;

    for (auto test : tests)
    {
        const double measured_conductivity = test.R * standard_conductivity;
        const double S = calculate_derived_salinity(measured_conductivity, test.t, test.p);

        BOOST_CHECK_CLOSE(S, test.S, 0.00001);
    }
}

BOOST_AUTO_TEST_CASE(test_specific_conductivity)
{
    struct TestData
    {
        double measured_conductivity;
        double temperature;
        double expected_specific_conductivity;
    };

    const TestData tests[] = {
        {717, 5, 1413},     {868, 10, 1413},    {1033, 15, 1413},   {1217, 20, 1413},
        {1413, 25, 1413},   {1626, 30, 1413},   {1851, 35, 1413},   {8210, 5, 12880},
        {9340, 10, 12880},  {10500, 15, 12880}, {11670, 20, 12880}, {12880, 25, 12880},
        {14140, 30, 12880}, {15420, 35, 12880},
        // Need to find 80,000 uS/cm value
    };

    for (auto test : tests)
    {
        const double specific_conductivity =
            calculate_specific_conductivity(test.measured_conductivity, test.temperature);
        BOOST_CHECK_CLOSE(specific_conductivity, test.expected_specific_conductivity, 2);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot

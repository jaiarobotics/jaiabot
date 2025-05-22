#define BOOST_TEST_MODULE jaiabot_test_utils
#include "jaiabot/utils/derived_salinity.h"
#include "jaiabot/utils/dissovled_oxygen_compensation.h"
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

BOOST_AUTO_TEST_CASE(test_dissolved_oxygen_compensation)
{
    struct TestData
    {
        double temp, salinity, max_do_expected;
    };

    const TestData tests[] = {
        // Reference:
        // https://www.nexsens.com/wp-content/uploads/2026/03/3.3_DissolvedOxygen_Figure1_Chart.jpg
        // https://atlas-scientific.com/dissolved-oxygen-calculator
        // https://water.usgs.gov/water-resources/software/DOTABLES/
        {0.0, 0.0, 14.621},  {25.0, 0.0, 8.263},  {0.0, 25.0, 12.277}, {10.0, 35.0, 9.024},
        {35.0, 10.0, 6.59},  {0.0, 30.0, 11.854}, {5.0, 30.0, 10.451}, {10.0, 30.0, 9.318},
        {15.0, 30.0, 8.389}, {20.0, 30.0, 7.617}, {25.0, 30.0, 6.967}, {30.0, 30.0, 6.41},
        {40.0, 40.0, 5.215},

    };

    for (auto test : tests)
    {
        const double max_do = calculate_dissolved_oxygen_solubility(test.temp, test.salinity);

        double percent_diff =
            100.0 * std::abs(max_do - test.max_do_expected) / test.max_do_expected;

        std::cout << "Temp: " << test.temp << " Salinity: " << test.salinity
                  << " Expected: " << test.max_do_expected << " Got: " << max_do
                  << " Percent diff: " << percent_diff << "%" << std::endl;

        BOOST_CHECK_CLOSE(max_do, test.max_do_expected, 2);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot

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
        double temp, salinity, do_solubility;
    };

    const TestData tests[] = {
        // Reference:
        // https://www.nexsens.com/wp-content/uploads/2026/03/3.3_DissolvedOxygen_Figure1_Chart.jpg
        // https://atlas-scientific.com/dissolved-oxygen-calculator
        // https://water.usgs.gov/water-resources/software/DOTABLES/
        // Salinity 0 ppt
        {0.0, 0, 14.62}, {5.0, 0, 12.77}, {10.0, 0, 11.29}, {15.0, 0, 10.08}, 
        {20.0, 0, 9.09}, {25.0, 0, 8.26}, {30.0, 0, 7.56}, {35.0, 0, 6.95}, 
        {40.0, 0, 6.41},
        // Salinity 5 ppt
        {0.0, 5, 14.12}, {5.0, 5, 12.35}, {10.0, 5, 10.93}, {15.0, 5, 9.78}, 
        {20.0, 5, 8.83}, {25.0, 5, 8.03}, {30.0, 5, 7.35}, {35.0, 5, 6.77}, 
        {40.0, 5, 6.25},
        // Salinity 15 ppt
        {0.0, 15, 13.16}, {5.0, 15, 11.55}, {10.0, 15, 10.26}, {15.0, 15, 9.20}, 
        {20.0, 15, 8.32}, {25.0, 15, 7.59}, {30.0, 15, 6.96}, {35.0, 15, 6.42}, 
        {40.0, 15, 5.93},
        // Salinity 25 ppt
        {0.0, 25, 12.28}, {5.0, 25, 10.81}, {10.0, 25, 9.62}, {15.0, 25, 8.65}, 
        {20.0, 25, 7.85}, {25.0, 25, 7.17}, {30.0, 25, 6.59}, {35.0, 25, 6.08}, 
        {40.0, 25, 5.64},
        // Salinity 35 ppt
        {0.0, 35, 11.45}, {5.0, 35, 10.11}, {10.0, 35, 9.02}, {15.0, 35, 8.14}, 
        {20.0, 35, 7.40}, {25.0, 35, 6.77}, {30.0, 35, 6.24}, {35.0, 35, 5.77}, 
        {40.0, 35, 5.35},
        // Salinity 40 ppt
        {0.0, 40, 11.05}, {5.0, 40, 9.78}, {10.0, 40, 8.74}, {15.0, 40, 7.89}, 
        {20.0, 40, 7.18}, {25.0, 40, 6.58}, {30.0, 40, 6.07}, {35.0, 40, 5.62}, 
        {40.0, 40, 5.22},
    };

    for (auto test : tests)
    {
        const double do_solubility = calculate_dissolved_oxygen_solubility(test.temp, test.salinity);

        double percent_diff =
            100.0 * std::abs(do_solubility - test.do_solubility) / test.do_solubility;

        std::cout << "Temp: " << test.temp << " Salinity: " << test.salinity
                  << " Expected: " << test.do_solubility << " Got: " << do_solubility
                  << " Percent diff: " << percent_diff << "%" << std::endl;

        BOOST_CHECK_CLOSE(do_solubility, test.do_solubility, 2);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot

#define BOOST_TEST_MODULE jaiabot_test_utils
#include "jaiabot/utils/derived_salinity.h"
#include "jaiabot/utils/ph_temperature_compensation.h"
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

BOOST_AUTO_TEST_CASE(test_ph_temperature_compensation)
{
    struct TestData
    {
        double ph_raw, temp, ph_expected;
    };

    const TestData tests[] = {
        // Reference: https://mantech-inc.com/faq/how-does-mantech-account-for-temperature-compensation-and-correction-in-ph-measurements/
        // PH: 4.00 at 25 C
        {3.775, 0.0, 4.00}, {3.82, 5.0, 4.00}, {3.91, 15.0, 4.00}, {4.00, 25.0, 4.00}, 
        {4.09, 35.0, 4.00}, {4.18, 45.0, 4.00},
        // PH: 10.00 at 25 C
        {10.225, 0.0, 10.00}, {10.18, 5.0, 10.00}, {10.09, 15.0, 10.00}, {10.00, 25.0, 10.00}, 
        {9.91, 35.0, 10.00}, {9.82, 45.0, 10.00},
        // Reference: https://www.horiba.com/usa/water-quality/support/technical-tips/bench-meters/automatic-temperature-compensation-in-ph-measurement/
        // PH: 7.00 at 25 C
        {7.12, 0.0, 7.00}, {7.09, 5.0, 7.00}, {7.06, 10.0, 7.00}, {7.04, 15.0, 7.00},
        {7.02, 20.0, 7.00}, {7.00, 25.0, 7.00}, {6.98, 30.0, 7.00}, {6.98, 35.0, 7.00},
        {6.97, 40.0, 7.00}, {6.97, 45.0, 7.00}, {6.97, 50.0, 7.00},
        // PH: 10.01 at 25 C
        {10.32, 0.0, 10.01}, {10.25, 5.0, 10.01}, {10.18, 10.0, 10.01}, {10.12, 15.0, 10.01},
        {10.06, 20.0, 10.01}, {10.01, 25.0, 10.01}, {9.97, 30.0, 10.01}, {9.93, 35.0, 10.01}, 
        {9.89, 40.0, 10.01}, {9.86, 45.0, 10.01}, {9.83, 50.0, 10.01},
    };

    for (auto test : tests)
    {
        const double ph_atc = temperature_compensated_ph(test.ph_raw, test.temp);

        double percent_diff = 100.0 * std::abs(ph_atc - test.ph_expected) / test.ph_expected;

        std::cout << "Measured: " << test.ph_raw
                << " Temp: " << test.temp
                << " Expected: " << test.ph_expected
                << " Got: " << ph_atc
                << " Percent diff: " << percent_diff << "%" << std::endl;

        BOOST_CHECK_CLOSE(ph_atc, test.ph_expected, 2);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot

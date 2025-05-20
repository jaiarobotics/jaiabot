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
        // PH: 4.00 corrected to 25 C
        {4.00, 0.0, 3.775}, {4.00, 5.0, 3.82}, {4.00, 15.0, 3.91}, {4.00, 25.0, 4.00}, 
        {4.00, 35.0, 4.09}, {4.00, 45.0, 4.18},
        // PH: 5 corrected to 25 C
        {5.00, 0.0, 4.85}, {5.00, 5.0, 4.88}, {5.00, 15.0, 4.94}, {5.00, 25.0, 5.00}, 
        {5.00, 35.0, 5.03}, {5.00, 45.0, 5.06},
        // PH: 7.00 corrected to 25 C
        {7.00, 0.0, 7.00}, {7.00, 5.0, 7.00}, {7.00, 15.0, 7.00}, {7.00, 25.0, 7.00}, 
        {7.00, 35.0, 7.00}, {7.00, 45.0, 7.00},
        // PH: 10.00 corrected to 25 C
        {10.00, 0.0, 10.225}, {10.00, 5.0, 10.18}, {10.00, 15.0, 10.09}, {10.00, 25.0, 10.00}, 
        {10.00, 35.0, 9.91}, {10.00, 45.0, 9.82},
        // PH: 14.00 corrected to 25 C
        {14.00, 0.0, 14.525}, {14.00, 5.0, 14.42}, {14.00, 15.0, 14.21}, {14.00, 25.0, 14.00}, 
        {14.00, 35.0, 13.79}, {14.00, 45.0, 13.58},
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

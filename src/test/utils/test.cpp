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
        // Hamilton reference: https://www.hamiltoncompany.com/process-analytics/conductivity-knowledge/temperature-influence-on-conductivity-standards
        // 147 uS/cm - reference: Hamilton
        {92, 5, 147}, {105, 10, 147}, {119, 15, 147}, {133, 20, 147},
        {147, 25, 147}, {162, 30, 147}, {176, 35, 147}, {192, 40, 147},
        // 12880 uS/cm - reference: Hamilton
        {8210, 5, 12880}, {8440, 6, 12880}, {8660, 7, 12880}, {8880, 8, 12880},
        {9110, 9, 12880}, {9340, 10, 12880}, {9560, 11, 12880}, {9790, 12, 12880},
        {10020, 13, 12880}, {10250, 14, 12880}, {10500, 15, 12880}, {10720, 16, 12880},
        {10960, 17, 12880}, {11200, 18, 12880}, {11430, 19, 12880}, {11670, 20, 12880},
        {11910, 21, 12880}, {12140, 22, 12880}, {12400, 23, 12880}, {12640, 24, 12880},
        {12880, 25, 12880}, {13140, 26, 12880}, {13380, 27, 12880}, {13630, 28, 12880},
        {13880, 29, 12880}, {14140, 30, 12880}, {14390, 31, 12880}, {14640, 32, 12880},
        {14890, 33, 12880}, {15150, 34, 12880}, {15420, 35, 12880}, {15660, 36, 12880},
        {15920, 37, 12880}, {16180, 38, 12880}, {16440, 39, 12880}, {16690, 40, 12880},
        {16960, 41, 12880}, {17220, 42, 12880}, {17490, 43, 12880}, {17750, 44, 12880},
        {18020, 45, 12880}, {18280, 46, 12880}, {18550, 47, 12880}, {18820, 48, 12880},
        {19080, 49, 12880}, {19350, 50, 12880},
        // 12880 uS/cm - reference: Atlas solution bottle
        {8220, 5, 12880}, {9220, 10, 12880}, {10480, 15, 12880}, {11670, 20, 12880},
        {12880, 25, 12880}, {14120, 30, 12880}, {15550, 35, 12880}, {16880, 40, 12880},
        {18210, 45, 12880}, {19550, 50, 12880},
        // 80,000 uS/cm - reference: Atlas solution bottle
        {53500, 5, 80000}, {59600, 10, 80000}, {65400, 15, 80000}, {72400, 20, 80000},
        {80000, 25, 80000}, {88200, 30, 80000}, {96400, 35, 80000}, {104600, 40, 80000},
        {112800, 45, 80000}, {121000, 50, 80000},
        // 100,000 uS/cm - reference: Hamilton
        {63000, 5, 100000}, {65000, 6, 100000}, {67000, 7, 100000}, {68000, 8, 100000},
        {70000, 9, 100000}, {72000, 10, 100000}, {74000, 11, 100000}, {75000, 12, 100000},
        {77000, 13, 100000}, {79000, 14, 100000}, {81000, 15, 100000}, {83000, 16, 100000},
        {84000, 17, 100000}, {86000, 18, 100000}, {88000, 19, 100000}, {90000, 20, 100000},
        {92000, 21, 100000}, {94000, 22, 100000}, {96000, 23, 100000}, {98000, 24, 100000},
        {100000, 25, 100000}, {102000, 26, 100000}, {104000, 27, 100000}, {106000, 28, 100000},
        {108000, 29, 100000}, {110000, 30, 100000}, {112000, 31, 100000}, {114000, 32, 100000},
        {116000, 33, 100000}, {118000, 34, 100000}, {120000, 35, 100000}, {122000, 36, 100000},
        {124000, 37, 100000}, {127000, 38, 100000}, {129000, 39, 100000}, {131000, 40, 100000},
        {133000, 41, 100000}, {135000, 42, 100000}, {137000, 43, 100000}, {140000, 44, 100000},
        {142000, 45, 100000}, {144000, 46, 100000}, {146000, 47, 100000}, {149000, 48, 100000},
        {151000, 49, 100000}, {153000, 50, 100000},
    };

    for (auto test : tests)
    {
        const double specific_conductivity =
            calculate_specific_conductivity(test.measured_conductivity, test.temperature);

        double percent_diff = 100.0 * std::abs(specific_conductivity - test.expected_specific_conductivity) / test.expected_specific_conductivity;

        std::cout << "Measured: " << test.measured_conductivity
                << " Temp: " << test.temperature
                << " Expected: " << test.expected_specific_conductivity
                << " Got: " << specific_conductivity
                << " Percent diff: " << percent_diff << "%" << std::endl;

        BOOST_CHECK_CLOSE(specific_conductivity, test.expected_specific_conductivity, 2);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot

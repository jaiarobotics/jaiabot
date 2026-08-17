#define BOOST_TEST_MODULE jaiabot_test_utils
#include "jaiabot/utils/derived_salinity.h"
#include "jaiabot/utils/dissolved_oxygen_compensation.h"
#include "jaiabot/utils/ip.h"
#include "jaiabot/utils/ph_temperature_compensation.h"
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
        {0.0, 0, 14.62},
        {5.0, 0, 12.77},
        {10.0, 0, 11.29},
        {15.0, 0, 10.08},
        {20.0, 0, 9.09},
        {25.0, 0, 8.26},
        {30.0, 0, 7.56},
        {35.0, 0, 6.95},
        {40.0, 0, 6.41},
        // Salinity 5 ppt
        {0.0, 5, 14.12},
        {5.0, 5, 12.35},
        {10.0, 5, 10.93},
        {15.0, 5, 9.78},
        {20.0, 5, 8.83},
        {25.0, 5, 8.03},
        {30.0, 5, 7.35},
        {35.0, 5, 6.77},
        {40.0, 5, 6.25},
        // Salinity 15 ppt
        {0.0, 15, 13.16},
        {5.0, 15, 11.55},
        {10.0, 15, 10.26},
        {15.0, 15, 9.20},
        {20.0, 15, 8.32},
        {25.0, 15, 7.59},
        {30.0, 15, 6.96},
        {35.0, 15, 6.42},
        {40.0, 15, 5.93},
        // Salinity 25 ppt
        {0.0, 25, 12.28},
        {5.0, 25, 10.81},
        {10.0, 25, 9.62},
        {15.0, 25, 8.65},
        {20.0, 25, 7.85},
        {25.0, 25, 7.17},
        {30.0, 25, 6.59},
        {35.0, 25, 6.08},
        {40.0, 25, 5.64},
        // Salinity 35 ppt
        {0.0, 35, 11.45},
        {5.0, 35, 10.11},
        {10.0, 35, 9.02},
        {15.0, 35, 8.14},
        {20.0, 35, 7.40},
        {25.0, 35, 6.77},
        {30.0, 35, 6.24},
        {35.0, 35, 5.77},
        {40.0, 35, 5.35},
        // Salinity 40 ppt
        {0.0, 40, 11.05},
        {5.0, 40, 9.78},
        {10.0, 40, 8.74},
        {15.0, 40, 7.89},
        {20.0, 40, 7.18},
        {25.0, 40, 6.58},
        {30.0, 40, 6.07},
        {35.0, 40, 5.62},
        {40.0, 40, 5.22},
    };

    for (auto test : tests)
    {
        const double do_solubility =
            calculate_dissolved_oxygen_solubility(test.temp, test.salinity);

        double percent_diff =
            100.0 * std::abs(do_solubility - test.do_solubility) / test.do_solubility;

        std::cout << "Temp: " << test.temp << " Salinity: " << test.salinity
                  << " Expected: " << test.do_solubility << " Got: " << do_solubility
                  << " Percent diff: " << percent_diff << "%" << std::endl;

        BOOST_CHECK_CLOSE(do_solubility, test.do_solubility, 2);
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
        // PH: 4.00 raw at different temperatures and corrected to 25 C
        {4.00, 0.0, 3.775},
        {4.00, 5.0, 3.82},
        {4.00, 15.0, 3.91},
        {4.00, 25.0, 4.00},
        {4.00, 35.0, 4.09},
        {4.00, 45.0, 4.18},
        // PH: 4.00 expected at 25 C with different raw input
        {4.225, 0.0, 4.00},
        {4.18, 5.0, 4.00},
        {4.09, 15.0, 4.00},
        {4.00, 25.0, 4.00},
        {3.91, 35.0, 4.00},
        {3.82, 45.0, 4.00},
        // PH: 5 raw at different temperatures and corrected to 25 C
        {5.00, 0.0, 4.85},
        {5.00, 5.0, 4.88},
        {5.00, 15.0, 4.94},
        {5.00, 25.0, 5.00},
        {5.00, 35.0, 5.03},
        {5.00, 45.0, 5.06},
        // PH: 5.00 expected at 25 C with different raw input
        {5.15, 0.0, 5.00},
        {5.12, 5.0, 5.00},
        {5.06, 15.0, 5.00},
        {5.00, 25.0, 5.00},
        {4.97, 35.0, 5.00},
        {4.94, 45.0, 5.00},
        // PH: 7.00 raw at different temperatures and corrected to 25 C
        {7.00, 0.0, 7.00},
        {7.00, 5.0, 7.00},
        {7.00, 15.0, 7.00},
        {7.00, 25.0, 7.00},
        {7.00, 35.0, 7.00},
        {7.00, 45.0, 7.00},
        // PH: 10.00 raw at different temperatures and corrected to 25 C
        {10.00, 0.0, 10.225},
        {10.00, 5.0, 10.18},
        {10.00, 15.0, 10.09},
        {10.00, 25.0, 10.00},
        {10.00, 35.0, 9.91},
        {10.00, 45.0, 9.82},
        // PH: 10.00 expected at 25 C with different raw input
        {9.775, 0.0, 10.00},
        {9.82, 5.0, 10.00},
        {9.91, 15.0, 10.00},
        {10.00, 25.0, 10.00},
        {10.09, 35.0, 10.00},
        {10.18, 45.0, 10.00},
        // PH: 14.00 raw at different temperatures and corrected to 25 C
        {14.00, 0.0, 14.525},
        {14.00, 5.0, 14.42},
        {14.00, 15.0, 14.21},
        {14.00, 25.0, 14.00},
        {14.00, 35.0, 13.79},
        {14.00, 45.0, 13.58},
        // PH: 14.00 expected at 25 C with different raw input
        {13.475, 0.0, 14.00},
        {13.58, 5.0, 14.00},
        {13.79, 15.0, 14.00},
        {14.00, 25.0, 14.00},
        {14.21, 35.0, 14.00},
        {14.42, 45.0, 14.00},
    };

    for (auto test : tests)
    {
        const double ph = temperature_compensated_ph(test.ph_raw, test.temp);

        double percent_diff = 100.0 * std::abs(ph - test.ph_expected) / test.ph_expected;

        std::cout << "Measured: " << test.ph_raw << " Temp: " << test.temp
                  << " Expected: " << test.ph_expected << " Got: " << ph
                  << " Percent diff: " << percent_diff << "%" << std::endl;

        BOOST_CHECK_CLOSE(ph, test.ph_expected, 2);
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
        {92, 5, 147},
        {105, 10, 147},
        {119, 15, 147},
        {133, 20, 147},
        {147, 25, 147},
        {162, 30, 147},
        {176, 35, 147},
        {192, 40, 147},
        // 12880 uS/cm - reference: Hamilton
        {8210, 5, 12880},
        {8440, 6, 12880},
        {8660, 7, 12880},
        {8880, 8, 12880},
        {9110, 9, 12880},
        {9340, 10, 12880},
        {9560, 11, 12880},
        {9790, 12, 12880},
        {10020, 13, 12880},
        {10250, 14, 12880},
        {10500, 15, 12880},
        {10720, 16, 12880},
        {10960, 17, 12880},
        {11200, 18, 12880},
        {11430, 19, 12880},
        {11670, 20, 12880},
        {11910, 21, 12880},
        {12140, 22, 12880},
        {12400, 23, 12880},
        {12640, 24, 12880},
        {12880, 25, 12880},
        {13140, 26, 12880},
        {13380, 27, 12880},
        {13630, 28, 12880},
        {13880, 29, 12880},
        {14140, 30, 12880},
        {14390, 31, 12880},
        {14640, 32, 12880},
        {14890, 33, 12880},
        {15150, 34, 12880},
        {15420, 35, 12880},
        {15660, 36, 12880},
        {15920, 37, 12880},
        {16180, 38, 12880},
        {16440, 39, 12880},
        {16690, 40, 12880},
        {16960, 41, 12880},
        {17220, 42, 12880},
        {17490, 43, 12880},
        {17750, 44, 12880},
        {18020, 45, 12880},
        {18280, 46, 12880},
        {18550, 47, 12880},
        {18820, 48, 12880},
        {19080, 49, 12880},
        {19350, 50, 12880},
        // 12880 uS/cm - reference: Atlas solution bottle
        {8220, 5, 12880},
        {9220, 10, 12880},
        {10480, 15, 12880},
        {11670, 20, 12880},
        {12880, 25, 12880},
        {14120, 30, 12880},
        {15550, 35, 12880},
        {16880, 40, 12880},
        {18210, 45, 12880},
        {19550, 50, 12880},
        // 80,000 uS/cm - reference: Atlas solution bottle
        {53500, 5, 80000},
        {59600, 10, 80000},
        {65400, 15, 80000},
        {72400, 20, 80000},
        {80000, 25, 80000},
        {88200, 30, 80000},
        {96400, 35, 80000},
        {104600, 40, 80000},
        {112800, 45, 80000},
        {121000, 50, 80000},
        // 100,000 uS/cm - reference: Hamilton
        {63000, 5, 100000},
        {65000, 6, 100000},
        {67000, 7, 100000},
        {68000, 8, 100000},
        {70000, 9, 100000},
        {72000, 10, 100000},
        {74000, 11, 100000},
        {75000, 12, 100000},
        {77000, 13, 100000},
        {79000, 14, 100000},
        {81000, 15, 100000},
        {83000, 16, 100000},
        {84000, 17, 100000},
        {86000, 18, 100000},
        {88000, 19, 100000},
        {90000, 20, 100000},
        {92000, 21, 100000},
        {94000, 22, 100000},
        {96000, 23, 100000},
        {98000, 24, 100000},
        {100000, 25, 100000},
        {102000, 26, 100000},
        {104000, 27, 100000},
        {106000, 28, 100000},
        {108000, 29, 100000},
        {110000, 30, 100000},
        {112000, 31, 100000},
        {114000, 32, 100000},
        {116000, 33, 100000},
        {118000, 34, 100000},
        {120000, 35, 100000},
        {122000, 36, 100000},
        {124000, 37, 100000},
        {127000, 38, 100000},
        {129000, 39, 100000},
        {131000, 40, 100000},
        {133000, 41, 100000},
        {135000, 42, 100000},
        {137000, 43, 100000},
        {140000, 44, 100000},
        {142000, 45, 100000},
        {144000, 46, 100000},
        {146000, 47, 100000},
        {149000, 48, 100000},
        {151000, 49, 100000},
        {153000, 50, 100000},
    };

    for (auto test : tests)
    {
        const double specific_conductivity =
            calculate_specific_conductivity(test.measured_conductivity, test.temperature);

        double percent_diff =
            100.0 * std::abs(specific_conductivity - test.expected_specific_conductivity) /
            test.expected_specific_conductivity;

        std::cout << "Measured: " << test.measured_conductivity << " Temp: " << test.temperature
                  << " Expected: " << test.expected_specific_conductivity
                  << " Got: " << specific_conductivity << " Percent diff: " << percent_diff << "%"
                  << std::endl;

        BOOST_CHECK_CLOSE(specific_conductivity, test.expected_specific_conductivity, 2);
    }
}

BOOST_AUTO_TEST_CASE(test_ip_ipv4_fleets)
{
    // every address a deployed fleet is using today
    BOOST_CHECK_EQUAL(ip::ipv4_addr(0, ip::Network::wlan, ip::NodeType::hub, 0), "10.23.0.10");
    BOOST_CHECK_EQUAL(ip::ipv4_addr(2, ip::Network::wlan, ip::NodeType::bot, 3), "10.23.2.103");
    BOOST_CHECK_EQUAL(ip::ipv4_addr(250, ip::Network::wlan, ip::NodeType::bot, 150),
                      "10.23.250.250");
    BOOST_CHECK_EQUAL(ip::ipv4_addr(1, ip::Network::wlan, ip::NodeType::gateway, 0), "10.23.1.1");
    BOOST_CHECK_EQUAL(ip::ipv4_addr(5, ip::Network::wlan, ip::NodeType::rpicam, 49), "10.23.5.99");
    BOOST_CHECK_EQUAL(ip::ipv4_net(2, ip::Network::wlan), "10.23.2.0/24");

    BOOST_CHECK_EQUAL(ip::ipv4_addr(3, ip::Network::fleet_vpn, ip::NodeType::bot, 5),
                      "172.23.3.105");
    BOOST_CHECK_EQUAL(ip::ipv4_addr(2, ip::Network::fleet_vpn, ip::NodeType::hub, 0),
                      "172.23.2.10");
    BOOST_CHECK_EQUAL(ip::ipv4_addr(3, ip::Network::fleet_vpn, ip::NodeType::gateway, 0),
                      "172.23.3.1");
    BOOST_CHECK_EQUAL(ip::ipv4_net(3, ip::Network::fleet_vpn), "172.23.3.0/24");

    BOOST_CHECK_EQUAL(ip::ipv4_net(7, ip::Network::cloudhub_eth), "10.23.255.0/24");
    BOOST_CHECK_EQUAL(ip::ipv4_net(7, ip::Network::vfleet_eth), "10.23.254.0/24");
    BOOST_CHECK_EQUAL(ip::ipv4_net(7, ip::Network::vpc), "10.23.0.0/16");
}

BOOST_AUTO_TEST_CASE(test_ip_vpn_ipv6)
{
    // the examples tabulated in src/doc/markdown/page056_cloud.md
    BOOST_CHECK_EQUAL(ip::ipv6_addr(4, ip::Network::fleet_vpn, ip::NodeType::bot, 5),
                      "fd91:5457:1e5c:4::1:5");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(250, ip::Network::fleet_vpn, ip::NodeType::bot, 6),
                      "fd91:5457:1e5c:fa::1:6");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(10, ip::Network::fleet_vpn, ip::NodeType::hub, 20),
                      "fd91:5457:1e5c:a::14");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(4, ip::Network::vfleet_vpn, ip::NodeType::bot, 5),
                      "fd6e:cf0d:aefa:4::1:5");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(15, ip::Network::cloudhub_vpn, ip::NodeType::hub, 30),
                      "fd0f:77ac:4fdf:f::1e");
    BOOST_CHECK_EQUAL(ip::ipv6_net(4, ip::Network::cloudhub_vpn), "fd0f:77ac:4fdf:4::/64");
}

BOOST_AUTO_TEST_CASE(test_ip_ipv6_fleets)
{
    BOOST_CHECK(ip::is_ipv4_fleet(ip::fleet_id_ipv4_max));
    BOOST_CHECK(!ip::is_ipv4_fleet(ip::fleet_id_ipv4_max + 1));

    BOOST_CHECK_EQUAL(ip::ipv6_addr(251, ip::Network::wlan, ip::NodeType::bot, 3),
                      "fddd:7f2e:3258:fb::1:3");
    BOOST_CHECK_EQUAL(ip::ipv6_net(251, ip::Network::wlan), "fddd:7f2e:3258:fb::/64");
    BOOST_CHECK_EQUAL(ip::ipv6_net(1000, ip::Network::wlan), "fddd:7f2e:3258:3e8::/64");
    BOOST_CHECK_EQUAL(ip::ipv6_net(4000, ip::Network::wlan), "fddd:7f2e:3258:fa0::/64");
    BOOST_CHECK_EQUAL(ip::ipv6_net(4000, ip::Network::fleet_vpn), "fd91:5457:1e5c:fa0::/64");

    BOOST_CHECK_THROW(ip::ipv4_addr(251, ip::Network::wlan, ip::NodeType::bot, 3),
                      std::invalid_argument);
    BOOST_CHECK_THROW(ip::ipv4_net(251, ip::Network::wlan), std::invalid_argument);
    BOOST_CHECK_THROW(ip::ipv4_net(251, ip::Network::fleet_vpn), std::invalid_argument);
    BOOST_CHECK_THROW(ip::ipv4_net(251, ip::Network::vfleet_wlan), std::invalid_argument);

    // the VPC networks do not carry the fleet id, so they stay IPv4 whatever the fleet
    BOOST_CHECK_EQUAL(ip::ipv4_net(251, ip::Network::cloudhub_eth), "10.23.255.0/24");
}

BOOST_AUTO_TEST_CASE(test_ip_fleet_subnet_id)
{
    BOOST_CHECK_EQUAL(ip::ipv6_net(0, ip::Network::wlan), "fddd:7f2e:3258::/64");
    BOOST_CHECK_EQUAL(ip::ipv6_net(255, ip::Network::wlan), "fddd:7f2e:3258:ff::/64");

    // the subnet id holds four nibbles, so raising fleet_id_max past 4095 needs nothing here
    BOOST_CHECK_EQUAL(ip::detail::ipv6_base(0x1234, ip::Network::wlan).to_string(),
                      "fddd:7f2e:3258:1234::");
    BOOST_CHECK_EQUAL(ip::detail::ipv6_base(0xffff, ip::Network::wlan).to_string(),
                      "fddd:7f2e:3258:ffff::");
}

BOOST_AUTO_TEST_CASE(test_ip_fleet_bounds)
{
    BOOST_CHECK_NO_THROW(ip::validate_fleet_id(ip::fleet_id_min));
    BOOST_CHECK_NO_THROW(ip::validate_fleet_id(ip::fleet_id_max));
    BOOST_CHECK_THROW(ip::validate_fleet_id(ip::fleet_id_min - 1), std::invalid_argument);
    BOOST_CHECK_THROW(ip::validate_fleet_id(ip::fleet_id_max + 1), std::invalid_argument);
}

BOOST_AUTO_TEST_CASE(test_ip_version)
{
    BOOST_CHECK(ip::ip_version(250, ip::Network::wlan) == ip::IPVersion::ipv4);
    BOOST_CHECK(ip::ip_version(251, ip::Network::wlan) == ip::IPVersion::ipv6);
    BOOST_CHECK(ip::ip_version(250, ip::Network::fleet_vpn) == ip::IPVersion::ipv4);
    BOOST_CHECK(ip::ip_version(251, ip::Network::fleet_vpn) == ip::IPVersion::ipv6);
    BOOST_CHECK(ip::ip_version(250, ip::Network::vfleet_wlan) == ip::IPVersion::ipv4);
    BOOST_CHECK(ip::ip_version(251, ip::Network::vfleet_wlan) == ip::IPVersion::ipv6);

    BOOST_CHECK(ip::ip_version(1, ip::Network::vfleet_vpn) == ip::IPVersion::ipv6);
    BOOST_CHECK(ip::ip_version(1, ip::Network::cloudhub_vpn) == ip::IPVersion::ipv6);

    BOOST_CHECK(ip::ip_version(4000, ip::Network::vpc) == ip::IPVersion::ipv4);
    BOOST_CHECK(ip::ip_version(4000, ip::Network::cloudhub_eth) == ip::IPVersion::ipv4);
    BOOST_CHECK(ip::ip_version(4000, ip::Network::vfleet_eth) == ip::IPVersion::ipv4);

    BOOST_CHECK_THROW(ip::ip_version(ip::fleet_id_max + 1, ip::Network::wlan),
                      std::invalid_argument);
}

BOOST_AUTO_TEST_CASE(test_ip_ipv6_node_offsets)
{
    // a group of its own per node type, so that the gateway is not also hub 1
    BOOST_CHECK_EQUAL(ip::ipv6_addr(251, ip::Network::wlan, ip::NodeType::hub, 1),
                      "fddd:7f2e:3258:fb::1");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(251, ip::Network::wlan, ip::NodeType::bot, 1),
                      "fddd:7f2e:3258:fb::1:1");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(251, ip::Network::wlan, ip::NodeType::desktop, 1),
                      "fddd:7f2e:3258:fb::2:1");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(251, ip::Network::wlan, ip::NodeType::rpicam, 1),
                      "fddd:7f2e:3258:fb::3:1");
    BOOST_CHECK_EQUAL(ip::ipv6_addr(251, ip::Network::wlan, ip::NodeType::gateway, 0),
                      "fddd:7f2e:3258:fb::4:0");
}

BOOST_AUTO_TEST_CASE(test_ip_host_codes)
{
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("b4f10"), "10.23.10.104");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("h1f2"), "10.23.2.11");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("b5sf3"), "172.23.3.105");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("b5vf3"), "fd6e:cf0d:aefa:3::1:5");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("chf3"), "fd0f:77ac:4fdf:3::1e");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("self"), "::1");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("hub.jaia.tech"), "hub.jaia.tech");

    BOOST_CHECK_EQUAL(ip::host_code_to_addr("b4f1000"), "fddd:7f2e:3258:3e8::1:4");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("h1f1000"), "fddd:7f2e:3258:3e8::1");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("b5sf1000"), "fd91:5457:1e5c:3e8::1:5");
    BOOST_CHECK_EQUAL(ip::host_code_to_addr("chf1000"), "fd0f:77ac:4fdf:3e8::1e");

    BOOST_CHECK_THROW(ip::host_code_to_addr("b4f5000"), std::invalid_argument);
    BOOST_CHECK_THROW(ip::host_code_to_addr("b4x2"), std::invalid_argument);
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace utils
} // namespace jaiabot

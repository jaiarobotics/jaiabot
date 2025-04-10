#define BOOST_TEST_MODULE jaiabot_test_units
#include "jaiabot/units/conductivity.h"
#include <boost/test/included/unit_test.hpp>
#include <boost/units/quantity.hpp>

#include "jaiabot/messages/sensor/atlas_scientific__oem_ec.pb.h"

namespace jaiabot
{
namespace units
{
BOOST_AUTO_TEST_SUITE(custom_units_tests)

BOOST_AUTO_TEST_CASE(test_conductivity)
{
    const boost::units::si::conductivity siemens_per_m;
    auto S_per_m_conductivity = 45.0 * siemens_per_m;
    decltype(S_per_m_conductivity) uS_per_cm_conductivity(45 * 10000.0 *
                                                          jaiabot::units::microsiemens_per_cm);

    BOOST_CHECK_CLOSE(S_per_m_conductivity.value(), uS_per_cm_conductivity.value(), 0.0001);

    // REQUIRES DCCL 4.2.2 - uncomment when we wrap this in
    //jaiabot::sensor::protobuf::AtlasScientificEZOEC ec_msg;
    //    ec_msg.set_conductivity_with_units(S_per_m_conductivity);
    //BOOST_CHECK_CLOSE(45 * 10000, ec_msg.conductivity(), 0.0001);
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace units
} // namespace jaiabot

#define BOOST_TEST_MODULE jaiabot_test_utils_stats
#include <boost/test/included/unit_test.hpp>

#include <boost/accumulators/accumulators.hpp>
#include <boost/accumulators/statistics.hpp>
#include <boost/circular_buffer.hpp>
#include <boost/units/quantity.hpp>
#include <boost/units/systems/si/area.hpp>
#include <boost/units/systems/si/length.hpp>

#include <cmath>
#include <stdexcept>

#include "jaiabot/utils/stats.h"

namespace si = boost::units::si;
using boost::units::quantity;
using jaiabot::utils::operator<<;
using jaiabot::utils::VarianceNorm::BIASED;
using jaiabot::utils::VarianceNorm::UNBIASED;

// percentage
constexpr auto TOL = 0.0001;

BOOST_AUTO_TEST_SUITE(RollingStatsAccumulatorSuite)

BOOST_AUTO_TEST_CASE(EmptyBuffer_ThrowsOnStats)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(5);

    // With no samples, expect exception
    BOOST_CHECK_THROW(acc.mean(), std::exception);
    BOOST_CHECK_THROW(acc.median(), std::exception);
    BOOST_CHECK_THROW(acc.variance(), std::exception);
    BOOST_CHECK_THROW(acc.stddev(), std::exception);
    BOOST_CHECK_THROW(acc.min(), std::exception);
    BOOST_CHECK_THROW(acc.max(), std::exception);
}

BOOST_AUTO_TEST_CASE(PartialFill_StatsMatchExpected)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(10);

    acc.push_back(1 * si::meters);
    acc.push_back(2 * si::meters);
    acc.push_back(3 * si::meters);

    std::cout << "PartialFill_StatsMatchExpected " << acc << std::endl;

    BOOST_CHECK_CLOSE(acc.mean().value(), 2.0, TOL);
    BOOST_CHECK_CLOSE(acc.median().value(), 2.0, TOL);
    BOOST_CHECK_CLOSE(acc.min().value(), 1.0, TOL);
    BOOST_CHECK_CLOSE(acc.max().value(), 3.0, TOL);

    // values from GNU Octave
    BOOST_CHECK_CLOSE(acc.stddev().value(), 1, TOL);
    BOOST_CHECK_CLOSE(acc.variance().value(), 1, TOL);
    BOOST_CHECK_CLOSE(acc.stddev(BIASED).value(), 0.8164965809277, TOL);
    BOOST_CHECK_CLOSE(acc.variance(BIASED).value(), 0.66666666666666, TOL);
}

BOOST_AUTO_TEST_CASE(SingleValue_VarZero)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(10);

    acc.push_back(1 * si::meters);

    std::cout << "SingleValue_VarZero " << acc << std::endl;

    BOOST_CHECK_CLOSE(acc.variance(UNBIASED).value(), 0, TOL);
    BOOST_CHECK_CLOSE(acc.variance(BIASED).value(), 0, TOL);
}

BOOST_AUTO_TEST_CASE(OddCount_MedianIsMiddle)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(5);

    acc.push_back(5.0 * si::meters);
    acc.push_back(1.0 * si::meters);
    acc.push_back(3.0 * si::meters);

    std::cout << "OddCount_MedianIsMiddle " << acc << std::endl;

    // Sorted: [1,3,5] => median = 3
    BOOST_CHECK_CLOSE(acc.median().value(), 3.0, TOL);
    // values from GNU Octave
    BOOST_CHECK_CLOSE(acc.stddev().value(), 2, TOL);
    BOOST_CHECK_CLOSE(acc.variance().value(), 4, TOL);
    BOOST_CHECK_CLOSE(acc.stddev(BIASED).value(), 1.632993161855452, TOL);
    BOOST_CHECK_CLOSE(acc.variance(BIASED).value(), 2.666666666666667, TOL);
}

BOOST_AUTO_TEST_CASE(EvenCount_MedianIsAverageOfMiddleTwo)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(10);

    acc.push_back(1.0 * si::meters);
    acc.push_back(10.0 * si::meters);
    acc.push_back(2.0 * si::meters);
    acc.push_back(9.0 * si::meters);

    std::cout << "EvenCount_MedianIsAverageOfMiddleTwo " << acc << std::endl;

    // Sorted: [1,2,9,10] => median = (2+9)/2 = 5.5
    BOOST_CHECK_CLOSE(acc.median().value(), 5.5, TOL);
    // values from GNU Octave
    BOOST_CHECK_CLOSE(acc.stddev().value(), 4.654746681256314, TOL);
    BOOST_CHECK_CLOSE(acc.variance().value(), 21.66666666666667, TOL);
    BOOST_CHECK_CLOSE(acc.stddev(BIASED).value(), 4.031128874149275, TOL);
    BOOST_CHECK_CLOSE(acc.variance(BIASED).value(), 16.25000000000000, TOL);
}

BOOST_AUTO_TEST_CASE(CircularOverwrite_DropsOldestSamples)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(3);

    // Fill
    acc.push_back(1.0 * si::meters);
    acc.push_back(2.0 * si::meters);
    acc.push_back(3.0 * si::meters);
    BOOST_CHECK_CLOSE(acc.mean().value(), 2.0, TOL);
    BOOST_CHECK_CLOSE(acc.min().value(), 1.0, TOL);
    BOOST_CHECK_CLOSE(acc.max().value(), 3.0, TOL);

    std::cout << "CircularOverwrite_DropsOldestSamples " << acc << std::endl;

    // Overwrite oldest (1.0) with 4.0 => buffer should contain [2,3,4]
    acc.push_back(4.0 * si::meters);

    std::cout << "AFTER overwrite: CircularOverwrite_DropsOldestSamples " << acc << std::endl;

    BOOST_CHECK_CLOSE(acc.mean().value(), 3.0, TOL);
    BOOST_CHECK_CLOSE(acc.median().value(), 3.0, TOL);
    BOOST_CHECK_CLOSE(acc.min().value(), 2.0, TOL);
    BOOST_CHECK_CLOSE(acc.max().value(), 4.0, TOL);
    BOOST_CHECK_CLOSE(acc.variance(BIASED).value(), 0.66666666666666, TOL);
}

BOOST_AUTO_TEST_CASE(HandlesNegativeValues)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(4);

    acc.push_back(-2.0 * si::meters);
    acc.push_back(-1.0 * si::meters);
    acc.push_back(1.0 * si::meters);
    acc.push_back(2.0 * si::meters);

    std::cout << "HandlesNegativeValues " << acc << std::endl;

    BOOST_CHECK_CLOSE(acc.mean().value(), 0.0, TOL);
    // Sorted: [-2,-1,1,2] => median = ( -1 + 1 ) / 2 = 0
    BOOST_CHECK_CLOSE(acc.median().value(), 0.0, TOL);
    BOOST_CHECK_CLOSE(acc.min().value(), -2.0, TOL);
    BOOST_CHECK_CLOSE(acc.max().value(), 2.0, TOL);

    // variance for [-2,-1,1,2]:
    BOOST_CHECK_CLOSE(acc.variance(BIASED).value(), 2.5, TOL);
}

BOOST_AUTO_TEST_CASE(QuantityTypeIsPreserved)
{
    jaiabot::utils::RollingStatsAccumulator<quantity<si::length>> acc(3);
    acc.push_back(1.0 * si::meters);
    acc.push_back(2.0 * si::meters);

    // Compile-time "test": these should be quantity<si::length>.
    quantity<si::length> m = acc.mean();
    quantity<si::length> med = acc.median();
    quantity<si::length> st = acc.stddev();
    quantity<si::length> mn = acc.min();
    quantity<si::length> mx = acc.max();

    // Variance is squared length = area
    quantity<si::area> v = acc.variance();

    (void)m;
    (void)med;
    (void)v;
    (void)st;
    (void)mn;
    (void)mx;
    BOOST_TEST(true); // if it compiles, we’re good
}

BOOST_AUTO_TEST_CASE(GreekAccessors)
{
    auto m = si::meters;
    using qL = quantity<si::length>;
    using qA = quantity<si::area>;
    using Σ = jaiabot::utils::RollingStatsAccumulator<quantity<si::length>>;

    Σ α(3);

    α(1 * m);
    α(2 * m);
    α(4 * m);

    std::cout << "GreekAccessors " << α << std::endl;

    qL μ = α.μ();
    qL σ = α.σ();
    qA σ2 = α.σ2();

    BOOST_CHECK_CLOSE(μ.value(), α.mean().value(), TOL);
    BOOST_CHECK_CLOSE(σ.value(), α.stddev().value(), TOL);
    BOOST_CHECK_CLOSE(σ2.value(), α.variance().value(), TOL);
}

BOOST_AUTO_TEST_SUITE_END()

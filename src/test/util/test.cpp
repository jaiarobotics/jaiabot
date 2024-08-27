#define BOOST_TEST_MODULE jaiabot_test_util

#include <boost/test/included/unit_test.hpp>
#include <boost/test/tools/output_test_stream.hpp>

#include "jaiabot/util/util.h"

using boost::test_tools::output_test_stream;

namespace jaiabot
{
namespace util
{
BOOST_AUTO_TEST_SUITE(remote_data_transfer_tests)

BOOST_AUTO_TEST_CASE(test_rsync_progress_parsing)
{
    FILE* pipe;
    uint32_t percentage;

    pipe = fopen("../test/util/resources/rsync_output.log", "r");

    if (pipe == NULL)
        perror("Error opening file");
    else
    {
        jaiabot::util::get_rsync_progress(pipe, percentage);
        BOOST_CHECK_EQUAL(percentage, 100);
    }
}

BOOST_AUTO_TEST_SUITE_END()

} // namespace util
} // namespace jaiabot

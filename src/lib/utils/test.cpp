#include "calibrated_salinity.h"

int main(int argc, char* argv[])
{
    auto passed = test_calculate_derived_salinity();

    return passed ? EXIT_SUCCESS : EXIT_FAILURE;
}

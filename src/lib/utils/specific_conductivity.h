// Specific conductivity - corrected value that represents the measured conductivity as if the solution were at a standard temperature of 25 °C
double calculate_specific_conductivity(const double measured_conductivity, const double temperature)
{
    double temperature_coefficient = 0.0191;
    double specific_conductivity;

    specific_conductivity = measured_conductivity / (1 + temperature_coefficient * (temperature - 25));

    return specific_conductivity;
}
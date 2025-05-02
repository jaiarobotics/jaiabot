double calculate_specific_conductivity(double conductivity, double temperature)
{
    double temperature_coefficient = 0.0191;
    double EC_25;

    EC_25 = conductivity / (1 + temperature_coefficient * (temperature - 25));

    return EC_25;
}
/**
 * @brief Viscosity ratio: µ_t / µ_25 using Hayashi's equation (log base 10)
 * 
 */
double viscosity_ratio(double temperature_celsius)
{
    const double A = 1.1278;
    const double B = 0.001895;
    const double C = 88.93;

    double delta = 25.0 - temperature_celsius;
    double log_ratio = (A * delta - B * delta * delta) / (temperature_celsius + C);

    return std::pow(10.0, log_ratio);
}

/**
 * @brief This function returns the tuning factor 'b' used in conductivity temperature
 * compensation. It’s based on a polynomial surface fitted to a bunch of known
 * reference solutions (like Hamilton and Atlas Scientific), where we had both
 * measured conductivity and the “true” specific conductivity.
 * 
 * The goal was to find a function for 'b' that works well across a wide range
 * of temperatures and conductivities — ideally within 1% error. Rather than hardcode
 * a bunch of if-statements, we fit a 3rd-degree polynomial using Python's
 * scikit-learn (PolynomialFeatures + LinearRegression)
 * 
 * @param measured_conductivity 
 * @param temperature 
 * @return double 
 */
double tuned_b(double measured_conductivity, double temperature)
{
    // Normalize inputs
    // range: ~0.05 to 1.5
    double ec = measured_conductivity / 100000.0;  
    // range: 0 to 1
    double t = temperature / 50.0;

    // Polynomial model: b = intercept + coef1*ec 
    //                        + coef2*t + coef3*ec*t 
    //                        + coef4*ec^2 + coef5*t^2
    double b =
        0.67132
        + 2.93970 * ec
        - 0.90973 * t
        - 11.85994 * ec * ec
        + 13.66141 * ec * t
        - 2.06555 * t * t
        + 12.93730 * ec * ec * ec
        - 26.03585 * ec * ec * t
        + 14.13775 * ec * t * t
        - 1.48252 * t * t * t;
    // Clamp - Limit to physical bounds
    return std::fmax(0.68, std::fmin(b, 0.88));
}

/**
 * @brief Specific conductivity - Viscosity-based compensation with auto-tuned b to get 
 * corrected value that represents the measured conductivity as if the solution were at a standard temperature of 25 °C
 * 
 * @param measured_conductivity 
 * @param temperature_celsius 
 * @return double 
 */
double calculate_specific_conductivity(const double measured_conductivity, const double temperature_celsius)
{
    double b = tuned_b(measured_conductivity, temperature_celsius);
    double mu_ratio = viscosity_ratio(temperature_celsius);
    return measured_conductivity * std::pow(mu_ratio, b);
}
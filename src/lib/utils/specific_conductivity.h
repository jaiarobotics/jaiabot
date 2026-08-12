/**
 * @brief Calculates the viscosity ratio µ_t / µ_25 using the empirical formula, 
 * which models how water's viscosity changes with temperature.
 *
 * The equation is:
 *     log10(µ_t / µ_25) = [A(25 - T) - B(25 - T)^2] / (T + C)
 *
 * This is used in conductivity compensation to adjust for the effect of temperature
 * on ion mobility.
 * 
 * @param temperature_celsius Temperature in degrees Celsius
 * @return double Viscosity ratio µ_t / µ_25
 * 
 * @note
 * 
 * References:
 *  - https://www.aqion.de/site/112
 *  - https://pubs.usgs.gov/wsp/2311/report.pdf
 *  - https://link.springer.com/article/10.1023/B:EMAS.0000031719.83065.68 (Hayashi study, 2004)
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
 * Inputs were normalized EC and temperature, and we calculated 'b' by rearranging:
 * 
 *     specific = measured * pow(mu_ratio, b)
 *      → b = log(expected / measured) / log(mu_ratio)
 * 
 *  The resulting fit works surprisingly well — it's smooth, doesn't need special
 *  cases, and holds up across all our test solutions from ~13 mS/cm up to 100 mS/cm,
 *  and 5°C to 50°C.
 * 
 * If you need to retrain this, check out the script in jaiabot/scripts/util-helpers/train-polynomial-specific-conductivity.py
 * 
 * @param measured_conductivity Measured EC in µS/cm
 * @param temperature_celsius Temperature in degrees Celsius
 * @return double Best-fit exponent b for temperature compensation
 */
double tuned_b(double measured_conductivity, double temperature_celsius)
{
    // Normalize inputs
    // range: ~0.05 to 1.5
    double ec = measured_conductivity / 100000.0;
    // range: 0 to 1
    double t = temperature_celsius / 50.0;

    // Polynomial model: b = intercept + coef1*ec
    //                        + coef2*t + coef3*ec*t
    //                        + coef4*ec^2 + coef5*t^2
    double b = 0.67132 + 2.93970 * ec - 0.90973 * t - 11.85994 * ec * ec + 13.66141 * ec * t -
               2.06555 * t * t + 12.93730 * ec * ec * ec - 26.03585 * ec * ec * t +
               14.13775 * ec * t * t - 1.48252 * t * t * t;
    // Clamp - Limit to physical bounds
    return std::fmax(0.68, std::fmin(b, 0.88));
}

/**
 * @brief Computes specific conductivity at 25 °C using temperature compensation.
 *
 * For measured conductivity values below 8000 µS/cm, this uses a standard linear
 * correction model based on a 1.91%/°C adjustment factor.
 *
 * For values above 8000 µS/cm, this uses a viscosity-based model with an
 * auto-tuned exponent 'b', derived from empirical data across a wide range of
 * temperatures and conductivities. This approach better captures nonlinear effects
 * at higher ion concentrations.
 * 
 * @param measured_conductivity Measured conductivity in µS/cm
 * @param temperature_celsius Temperature of the measurement in degrees Celsius
 * @return double Specific conductivity at 25 °C
 */
double calculate_specific_conductivity(const double measured_conductivity,
                                       const double temperature_celsius)
{
    if (measured_conductivity < 8000.0)
    {
        // Linear model for low EC (<8000 µS/cm)
        return measured_conductivity / (1.0 + 0.0191 * (temperature_celsius - 25.0));
    }
    else
    {
        double b = tuned_b(measured_conductivity, temperature_celsius);
        double mu_ratio = viscosity_ratio(temperature_celsius);
        return measured_conductivity * std::pow(mu_ratio, b);
    }
}
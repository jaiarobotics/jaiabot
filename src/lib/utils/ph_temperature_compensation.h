/**
 * @brief This function applies Nernst-based automatic temperature compensation to adjust a pH 
 * reading measured at temperature T, translating it to the equivalent value at 25 °C
 * 
 * pH electrodes become more sensitive as temperature increases due to the Nernst equation:
 *     slope = (2.303 * R * T) / (n * F) ≈ 0.1984 × T (in Kelvin)
 * 
 * This slope determines how much the electrode voltage changes per pH unit.
 * At 25°C (298.15 K), the slope is ~59.16 mV/pH — the standard used during calibration.
 * 
 * If a pH value is measured at a different temperature, its deviation from pH 7.0
 * must be scaled back to match what the reading would have been at 25°C.
 * 
 * This function assumes the input pH was measured using the slope corresponding
 * to the actual in-situ temperature, and adjusts it to match the reference slope at 25°C.
 * 
 * @param measured_ph         pH value measured at in-situ temperature (not yet compensated)
 * @param temperature_celsius in-situ temperature at time of measurement
 * @return double             pH value compensated to 25°C conditions
 * 
 * @note This does not convert voltage to pH, but adjusts an already computed pH value.
 * 
 * References:
 *   - https://mantech-inc.com/faq/how-does-mantech-account-for-temperature-compensation-and-correction-in-ph-measurements/
 *   - https://atlas-scientific.com/ph-temperature-calculator/
 *   - https://www.horiba.com/usa/water-quality/support/technical-tips/bench-meters/automatic-temperature-compensation-in-ph-measurement/
 */
double temperature_compensated_ph(double measured_ph, double temperature_celsius)
{
    const double slope_at_25C = 59.16; // mV/pH at 25°C
    double temp_kelvin = temperature_celsius + 273.15;
    double slope = 0.1984 * temp_kelvin;

    return 7.0 + (measured_ph - 7.0) * (slope_at_25C / slope);
}

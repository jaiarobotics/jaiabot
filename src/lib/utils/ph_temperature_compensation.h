/**
 * @brief Applies automatic temperature compensation (ATC) to a raw pH value using the Nernst equation.
 * The Nernst equation describes how the voltage output of a pH electrode changes with temperature:
 *     E = E₀ - (2.303 * R * T / nF) * pH
 * 
 * From this, we derive the theoretical electrode slope (mV per pH unit) as:
 *      slope = (2.303 * R * T) / (n * F) ≈ 0.1984 × T (in Kelvin)
 * 
 * At 25°C (298.15 K), the slope is ~59.16 mV/pH — considered the reference slope.
 * This function adjusts the pH reading by scaling its deviation from pH 7.0
 * using the ratio between the actual slope at the measured temperature
 * and the standard slope at 25°C.
 * 
 * @param measured_ph is based on an electrode calibrated at 25°C (typical NBS buffer calibration)
 * @param temperature_celsius is the in-situ measurement temperature
 * @return double A compensated pH value adjusted for temperature effects on electrode sensitivity
 * 
 * @note
 *  References:
 *      * https://cdn.hach.com/7FYZVWYB/at/7jpb8qbgw4v62mvtc88vqg74/LIT2007-Temperature_Compensation_with_pH_Measurement.pdf
 *      * https://www.horiba.com/usa/water-quality/support/technical-tips/bench-meters/automatic-temperature-compensation-in-ph-measurement/
 *      * https://mantech-inc.com/faq/how-does-mantech-account-for-temperature-compensation-and-correction-in-ph-measurements/
 */
double temperature_compensated_ph(double measured_ph, double temperature_celsius)
{
    const double slope_at_25C = 59.16; // mV/pH at 25°C
    double temp_kelvin = temperature_celsius + 273.15;
    double slope = 0.1984 * temp_kelvin;

    return 7.0 + (measured_ph - 7.0) * (slope / slope_at_25C);
}

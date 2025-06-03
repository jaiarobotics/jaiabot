#include <cmath>

/**
 * @brief Approximates the effect of barometric pressure on dissolved oxygen (DO) solubility.
 * 
 * This function applies a simple linear scaling based on the ratio of the measured pressure
 * to standard sea-level pressure (760 mmHg). It is suitable for most field applications where
 * high-precision correction is not required.
 * 
 * For more precise calculations, especially at high elevations or in scientific contexts,
 * a more complex model accounting for non-ideal gas behavior, water vapor pressure, and
 * oxygen mole fraction is available in equations (9)–(11) of the USGS WQ.2011.03 memo.
 * 
 * @param pressure_mmhg Barometric pressure in mmHg (default: 760 mmHg).
 * @return Approximate correction factor to scale DO solubility for pressure deviations.
 * 
 * Reference:
 * - USGS WQ.2011.03: https://water.usgs.gov/water-resources/memos/documents/WQ.2011.03.pdf
 */
double pressure_correction(double pressure_mmhg = 760.0) { return pressure_mmhg / 760.0; }

/**
 * @brief Computes the salinity correction factor for dissolved oxygen solubility.
 * 
 * This factor adjusts the oxygen solubility downward based on increased salinity.
 * 
 * @param temperature_k Water temperature in Kelvin.
 * @param salinity_ppt Salinity in parts per thousand (ppt).
 * @return Salinity correction factor (unitless).
 * 
 * Reference: Garcia & Gordon (1992), also adopted by USGS:
 * - https://water.usgs.gov/water-resources/memos/documents/WQ.2011.03.pdf
 */
double salinity_correction(double temperature_k, double salinity_ppt)
{
    // base salinity correction
    const double sal_corr_a = 0.017674;
    // adjusts salinity correction based on temperature
    const double sal_corr_b = 10.754;
    // quadratic temp-based adjustment to salinity effect
    const double sal_corr_c = 2140.7;

    return std::exp(-salinity_ppt * (sal_corr_a - (sal_corr_b / temperature_k) +
                                     (sal_corr_c / (temperature_k * temperature_k))));
}

/**
 * @brief Calculates the saturation concentration of dissolved oxygen in freshwater at 1 atm and 0 ppt salinity.
 * 
 * This is based on the Benson & Krause (1984) equation recommended by USGS for high-accuracy DO solubility estimates.
 * It returns the maximum possible DO (mg/L) at a given temperature in °C.
 * 
 * @param temperature_k Water temperature in degrees Kelvin.
 * @return DO saturation in mg/L at standard atmospheric pressure and zero salinity.
 * 
 * Reference:
 * - Weiss, R. F. (1970). The solubility of nitrogen, oxygen and argon in water and seawater.
 * - USGS WQ.2011.03 memo: https://water.usgs.gov/water-resources/memos/documents/WQ.2011.03.pdf
 */
double calculate_do_saturation_fresh(double temperature_k)
{
    // Constants from Weiss (1970), Equation (7) in USGS WQ.2011.03
    const double a0 = -173.4292;
    const double a1 = 249.6339;
    const double a2 = 143.3483;
    const double a3 = -21.8492;
    const double oxygen_conversion = 1.42905; // mL/L to mg/L at STP
    const double temp_scale = 100.0;

    double scaled_temp = temperature_k / temp_scale;

    double ln_do =
        a0 + a1 * (temp_scale / temperature_k) + a2 * std::log(scaled_temp) + a3 * scaled_temp;

    return oxygen_conversion * std::exp(ln_do);
}

/**
 * @brief Calculates the dissolved oxygen (DO) solubility in mg/L, corrected for temperature, salinity, and pressure.
 * 
 * This function estimates the maximum amount of oxygen that water can hold under the given conditions.
 * It uses the Weiss (1970) equation for DO saturation at 0 ppt salinity and 1 atm pressure,
 * then applies salinity and pressure correction factors to reflect real-world conditions.
 *
 * The result represents oxygen solubility at equilibrium with the atmosphere — useful for
 * calculating % saturation or comparing measured DO values to environmental capacity.
 * 
 * @param temperature_celsius Water temperature in degrees Celsius.
 * @param salinity_ppt Salinity in parts per thousand (ppt).
 * @param pressure_mmhg Barometric pressure in mmHg (default is standard: 760 mmHg).
 * @return DO solubility in mg/L under the specified conditions.
 * 
 * References:
 * - Weiss, R. F. (1970). The solubility of nitrogen, oxygen and argon in water and seawater.
 * - USGS WQ.2011.03: https://water.usgs.gov/water-resources/memos/documents/WQ.2011.03.pdf
 * - USGS DO Tables: https://water.usgs.gov/water-resources/software/DOTABLES/
 */
double calculate_dissolved_oxygen_solubility(double temperature_celsius, double salinity_ppt,
                                             double pressure_mmhg = 760.0)
{
    const double kelvin_offset = 273.15;
    double temperature_k = temperature_celsius + kelvin_offset;
    double do_saturation = calculate_do_saturation_fresh(temperature_k);
    double salinity_factor = salinity_correction(temperature_k, salinity_ppt);
    double pressure_factor = pressure_correction(pressure_mmhg);

    return do_saturation * salinity_factor * pressure_factor;
}

/**
 * @brief Calculates dissolved oxygen (DO) percent saturation.
 * 
 * This function expresses the measured DO concentration as a percentage of
 * the theoretical maximum solubility under current temperature, salinity,
 * and pressure conditions.
 * 
 * Percent saturation >100% indicates supersaturation (e.g., from photosynthesis),
 * while <100% indicates undersaturation (e.g., from respiration or pollution).
 * 
 * @param do_raw Measured dissolved oxygen concentration in mg/L.
 * @param do_max DO solubility in mg/L under current environmental conditions.
 * @return Percent saturation (%).
 */
double calculate_do_saturation_percent(double do_raw, double do_max)
{
    return (do_raw / do_max) * 100.0;
}
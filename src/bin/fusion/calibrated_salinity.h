#include <math.h>

double calculate_calibrated_salinity(const double measured_conductivity, const double temperature,
                                     const double pressure)
{
    // Calculate salinity given measured conductivity, temperature, and pressure.

    // Params:
    //     measured_conductivity: {double} measured conductivity in μS/cm
    //     temperature: {double} temperature in deg C
    //     pressure: {double} pressure in decibars

    // Returns:
    //     {double} salinity in PSU (ppt)

    // Salinity constants
    const double a0 = 0.0080;
    const double a1 = -0.1692;
    const double a2 = 25.3851;
    const double a3 = 14.0941;
    const double a4 = -7.0261;
    const double a5 = 2.7081;

    const double b0 = 0.0005;
    const double b1 = -0.0056;
    const double b2 = -0.0066;
    const double b3 = -0.0375;
    const double b4 = 0.0636;
    const double b5 = -0.0144;

    const double c0 = 0.6766097;
    const double c1 = 2.00564e-2;
    const double c2 = 1.104259e-4;
    const double c3 = -6.9698e-7;
    const double c4 = 1.0031e-9;

    const double d0 = 3.426e-2;
    const double d1 = 4.464e-4;
    const double d2 = 4.215e-1;
    const double d3 = -3.107e-3;

    const double e0 = 2.070e-5;
    const double e1 = -6.370e-10;
    const double e2 = 3.989e-15;

    const double k = 0.0162;

    const double standard_conductivity = 42914;

    // Salinity calculations
    const double R = round((measured_conductivity / standard_conductivity) * 100.0) / 100.0;
    const double t = temperature;
    const double p = pressure;

    const double Rp = 1 + (p * (e0 + (e1 * p) + (e2 * p * p))) /
                              (1 + (d0 * t) + (d1 * t * t) + (d2 + (d3 * t)) * R);
    const double rt = c0 + (c1 * t) + (c2 * t * t) + (c3 * t * t * t) + (c4 * pow(t, 4));
    const double Rt = R / (Rp * rt);
    const double dS = (t - 15) *
                      (b0 + (b1 * sqrt(Rt)) + (b2 * Rt) + (b3 * pow(Rt, 1.5)) + (b4 * Rt * Rt) +
                       (b5 * pow(Rt, 2.5))) /
                      (1 + k * (t - 15));

    const double S = a0 + (a1 * sqrt(Rt)) + (a2 * Rt) + (a3 * pow(Rt, 1.5)) + (a4 * Rt * Rt) +
                     (a5 * pow(Rt, 2.5)) + dS;

    return S;
}

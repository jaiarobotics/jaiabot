#ifndef JAIABOT_UTILS_HAMPEL_FILTER_H
#define JAIABOT_UTILS_HAMPEL_FILTER_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <deque>
#include <vector>

namespace jaiabot
{
namespace utils
{
// Live Hampel filter for detecting outliers in a sensor data
// stream. It keeps a window of the most recent readings and flags a reading as
// an outlier when it lies more than
// num_mads * standard deviation scaling factor * median absolute deviation (MAD)
// from the window median: |x - median| > num_mads * (1.4826 * MAD), where
// MAD = median(|sensor_data - median|). The median and MAD are used instead of the mean
// and standard deviation so a spike can't shift the statistics used to
// judge it. The 1.4826 factor makes the MAD approximate a standard deviation.
class HampelFilter
{
  public:
    static constexpr double MAD_TO_STDDEV_SCALE = 1.4826;

    // window_size: recent readings used to estimate the median/MAD (min 1).
    // num_mads: outlier threshold as a multiple of the scaled MAD.
    explicit HampelFilter(std::size_t window_size = 7, double num_mads = 3.0)
        : window_size_(window_size < 1 ? 1 : window_size), num_mads_(num_mads)
    {
    }

    // Outcome of filtering a single reading.
    struct Result
    {
        double value{0.0};        // The input value (never modified).
        bool is_outlier{false};   // True if the value was flagged as an outlier.
        bool has_estimate{false}; // False during warm-up (window not yet full).
        double median{0.0};       // Window median used for the decision.
        double scaled_mad{0.0};   // 1.4826 * MAD used for the decision.
    };

    // Add a reading to the window and evaluate whether it is an outlier.
    Result filter(double value)
    {
        window_.push_back(value);
        if (window_.size() > window_size_)
            window_.pop_front();

        Result result;
        result.value = value;
        result.median = value;

        // Don't start the filter until we have a full data window.
        if (window_.size() < window_size_)
            return result;

        // Find the typical (median) value of the window.
        std::vector<double> window(window_.begin(), window_.end());
        const double med = compute_median(window);

        // Measure how spread out the window is: take how far each reading sits
        // from the median, then the median of those distances (the MAD).
        std::vector<double> deviations;
        deviations.reserve(window.size());
        for (const double v : window) deviations.push_back(std::fabs(v - med));
        const double scaled_mad = MAD_TO_STDDEV_SCALE * compute_median(deviations);

        result.median = med;
        result.scaled_mad = scaled_mad;
        result.has_estimate = true;

        // If every sample in the window is the same, we can't distinguish a
        // real sensor reading change from an outlier, so accept the value.
        if (scaled_mad > 0.0 && std::fabs(value - med) > num_mads_ * scaled_mad)
            result.is_outlier = true;

        return result;
    }

    // Clear all stored history (e.g. between missions or on sensor restart).
    void reset() { window_.clear(); }

    // True once the window is full and the filter can flag outliers.
    bool is_warmed_up() const { return window_.size() >= window_size_; }

    std::size_t window_size() const { return window_size_; }
    double num_mads() const { return num_mads_; }
    std::size_t samples_buffered() const { return window_.size(); }

  private:
    // Find the median: sort the readings and take the middle value. Takes a
    // copy because sorting reorders the input.
    static double compute_median(std::vector<double> data)
    {
        std::sort(data.begin(), data.end());
        const std::size_t n = data.size();
        const std::size_t mid = n / 2;
        if (n % 2 == 1)
            return data[mid];

        // Even number of readings: average the two middle values.
        return 0.5 * (data[mid - 1] + data[mid]);
    }

    std::size_t window_size_;
    double num_mads_;
    std::deque<double> window_;
};

} // namespace utils
} // namespace jaiabot

#endif // JAIABOT_UTILS_HAMPEL_FILTER_H

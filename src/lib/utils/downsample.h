#ifndef JAIABOT_UTILS_DOWNSAMPLE_H
#define JAIABOT_UTILS_DOWNSAMPLE_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdlib>
#include <sstream>
#include <string>
#include <vector>

// Example: rows are "index value1 value2 value3". Selectors receive the values after
// the index, so values[0] is value1. This uses value1 for x and value3 for y:
//
// jaiabot::utils::downsample_to_max_bytes(
//     lines, max_bytes, 3, // values[2] is indexed below, so rows need 3 numeric columns
//     [](const std::vector<double>& values) { return values[0]; },
//     [](const std::vector<double>& values) { return values[2]; });

namespace jaiabot
{
namespace utils
{

/// x/y coordinates of one data row.
struct DownsamplePoint
{
    double x;
    double y;
};

/**
 * @brief Selects indices that preserve the overall shape of the data.
 *
 * Uses Largest-Triangle-Three-Buckets; the first and last points are always kept.
 *
 * @param points Ordered input points to sample.
 * @param target_size Number of points to retain.
 * @return Indices into @p points for the selected representative points.
 */
inline std::vector<size_t> select_downsample_indices(const std::vector<DownsamplePoint>& points,
                                                     size_t target_size)
{
    if (points.empty())
    {
        return {};
    }

    if (target_size >= points.size())
    {
        std::vector<size_t> all_indices;
        all_indices.reserve(points.size());
        for (size_t i = 0; i < points.size(); ++i) { all_indices.push_back(i); }
        return all_indices;
    }

    if (target_size <= 2)
    {
        return {0, points.size() - 1};
    }

    std::vector<size_t> selected_indices;
    selected_indices.reserve(target_size);

    const size_t n = points.size();
    const double bucket_width = static_cast<double>(n - 2) / static_cast<double>(target_size - 2);

    selected_indices.push_back(0);
    size_t prev_selected_index = 0;

    for (size_t i = 0; i < target_size - 2; ++i)
    {
        size_t next_bucket_start = static_cast<size_t>(std::floor((i + 1) * bucket_width)) + 1;
        size_t next_bucket_end = static_cast<size_t>(std::floor((i + 2) * bucket_width)) + 1;
        next_bucket_end = std::min(next_bucket_end, n);
        next_bucket_start = std::min(next_bucket_start, n);

        double next_bucket_avg_x = 0.0;
        double next_bucket_avg_y = 0.0;
        const size_t next_bucket_count =
            (next_bucket_end > next_bucket_start) ? (next_bucket_end - next_bucket_start) : 0;

        for (size_t next_bucket_index = next_bucket_start; next_bucket_index < next_bucket_end;
             ++next_bucket_index)
        {
            next_bucket_avg_x += points[next_bucket_index].x;
            next_bucket_avg_y += points[next_bucket_index].y;
        }

        if (next_bucket_count > 0)
        {
            next_bucket_avg_x /= static_cast<double>(next_bucket_count);
            next_bucket_avg_y /= static_cast<double>(next_bucket_count);
        }
        else
        {
            next_bucket_avg_x = points[prev_selected_index].x;
            next_bucket_avg_y = points[prev_selected_index].y;
        }

        size_t bucket_start = static_cast<size_t>(std::floor(i * bucket_width)) + 1;
        size_t bucket_end = static_cast<size_t>(std::floor((i + 1) * bucket_width)) + 1;
        bucket_start = std::min(bucket_start, n - 1);
        bucket_end = std::min(bucket_end, n - 1);
        if (bucket_end <= bucket_start)
        {
            bucket_end = std::min(bucket_start + 1, n - 1);
        }

        const DownsamplePoint& prev_point = points[prev_selected_index];
        double max_area = -1.0;
        size_t best_index = bucket_start;

        for (size_t candidate = bucket_start; candidate < bucket_end; ++candidate)
        {
            const double area =
                0.5 * std::abs(prev_point.x * (points[candidate].y - next_bucket_avg_y) +
                               points[candidate].x * (next_bucket_avg_y - prev_point.y) +
                               next_bucket_avg_x * (prev_point.y - points[candidate].y));

            if (area > max_area)
            {
                max_area = area;
                best_index = candidate;
            }
        }

        selected_indices.push_back(best_index);
        prev_selected_index = best_index;
    }

    selected_indices.push_back(n - 1);
    return selected_indices;
}

/**
 * @brief Parses @p token into @p value_out only if the whole token is numeric.
 *
 * Unlike stream extraction, this rejects tokens that only begin with a number (e.g. "12:00").
 *
 * @param token Whitespace-free token to parse.
 * @param value_out Parsed value written on success.
 * @param integer_only Reject tokens that are not base-10 integers.
 * @return True when the whole token was consumed.
 */
inline bool parse_numeric_token(const std::string& token, double& value_out, bool integer_only)
{
    if (token.empty())
    {
        return false;
    }

    char* end = nullptr;
    value_out = integer_only ? static_cast<double>(std::strtoll(token.c_str(), &end, 10))
                             : std::strtod(token.c_str(), &end);
    return *end == '\0';
}

/**
 * @brief Parses the numeric columns after a row's integer index.
 *
 * The row is expected to begin with an integer index followed by at least
 * @p min_value_count numeric values. Every token must be numeric, so lines like
 * timestamps aren't mistaken for data rows.
 *
 * @param line Input row to parse.
 * @param values_out Parsed numeric columns written on success.
 * @param min_value_count Minimum numeric columns the row must contain to be accepted.
 * @return True if the line is a data row with at least @p min_value_count values.
 */
inline bool parse_data_row(const std::string& line, std::vector<double>& values_out,
                           size_t min_value_count = 2)
{
    std::istringstream row_stream(line);
    std::string token;
    double row_index = 0.0;
    if (!(row_stream >> token) || !parse_numeric_token(token, row_index, true))
    {
        return false;
    }

    values_out.clear();
    double value = 0.0;
    while (row_stream >> token)
    {
        if (!parse_numeric_token(token, value, false))
        {
            return false;
        }
        values_out.push_back(value);
    }

    // Never accept an empty row, even if the caller asks for zero columns.
    if (values_out.empty() || values_out.size() < min_value_count)
    {
        return false;
    }

    return true;
}

/**
 * @brief Computes the serialized byte size of lines joined with newline separators.
 *
 * @param lines Lines to measure.
 * @return Total byte count including newline separators between lines.
 */
inline size_t joined_size_bytes(const std::vector<std::string>& lines)
{
    if (lines.empty())
    {
        return 0;
    }

    size_t total_bytes = 0;
    for (const std::string& line : lines) { total_bytes += line.size(); }

    // Newline separators between lines.
    total_bytes += lines.size() - 1;
    return total_bytes;
}

/**
 * @brief Keeps all metadata lines and only the data rows in @p selected_row_indices.
 *
 * @param input_lines Original input lines.
 * @param data_line_positions Positions of parsed data rows within @p input_lines.
 * @param selected_row_indices Indices of data rows to keep.
 * @return Filtered output lines with metadata preserved.
 */
inline std::vector<std::string> keep_selected_rows(const std::vector<std::string>& input_lines,
                                                   const std::vector<size_t>& data_line_positions,
                                                   const std::vector<size_t>& selected_row_indices)
{
    std::vector<bool> keep_data_row(data_line_positions.size(), false);
    for (size_t selected_row_index : selected_row_indices)
    {
        if (selected_row_index < keep_data_row.size())
        {
            keep_data_row[selected_row_index] = true;
        }
    }

    std::vector<std::string> output_lines;
    output_lines.reserve(input_lines.size());

    size_t data_row_index = 0;
    for (size_t line_index = 0; line_index < input_lines.size(); ++line_index)
    {
        if (data_row_index < data_line_positions.size() &&
            data_line_positions[data_row_index] == line_index)
        {
            if (keep_data_row[data_row_index])
            {
                output_lines.push_back(input_lines[line_index]);
            }
            ++data_row_index;
        }
        else
        {
            output_lines.push_back(input_lines[line_index]);
        }
    }

    return output_lines;
}

/**
 * @brief Downsamples data rows to fit within @p max_bytes.
 *
 * Keeps all metadata lines and binary searches for the most data rows that fit. The
 * selectors map each row's values (after the index) to x/y coordinates.
 *
 * Since the selectors index those values directly, @p min_value_count must cover the
 * widest column they read; narrower rows are left as metadata instead of being selected on.
 *
 * @tparam XSelector `double(const std::vector<double>&)` callable.
 * @tparam YSelector `double(const std::vector<double>&)` callable.
 * @param input_lines Full input dataset, including metadata and data rows.
 * @param max_bytes Maximum allowed serialized size for the returned dataset.
 * @param min_value_count Minimum numeric columns a data row must contain.
 * @param x_selector Selects the x coordinate from parsed numeric columns.
 * @param y_selector Selects the y coordinate from parsed numeric columns.
 * @return Lines within @p max_bytes. Metadata and the first/last data rows are always
 *         kept, even if they alone exceed the budget.
 */
template <typename XSelector, typename YSelector>
inline std::vector<std::string> downsample_to_max_bytes(const std::vector<std::string>& input_lines,
                                                        size_t max_bytes, size_t min_value_count,
                                                        XSelector x_selector, YSelector y_selector)
{
    std::vector<DownsamplePoint> data_points;
    std::vector<size_t> data_line_positions;
    data_points.reserve(input_lines.size());
    data_line_positions.reserve(input_lines.size());

    std::vector<double> values;

    for (size_t i = 0; i < input_lines.size(); ++i)
    {
        if (parse_data_row(input_lines[i], values, min_value_count))
        {
            DownsamplePoint point{};
            point.x = static_cast<double>(x_selector(values));
            point.y = static_cast<double>(y_selector(values));
            data_points.push_back(point);
            data_line_positions.push_back(i);
        }
    }

    if (data_points.size() <= 2)
    {
        return input_lines;
    }

    // Keep at least first and last data row, then maximize kept rows within byte budget.
    size_t low = 2;
    size_t high = data_points.size();
    size_t best_row_count = 2;

    while (low <= high)
    {
        const size_t mid = low + (high - low) / 2;
        const std::vector<size_t> selected_row_indices =
            select_downsample_indices(data_points, mid);
        const std::vector<std::string> candidate_lines =
            keep_selected_rows(input_lines, data_line_positions, selected_row_indices);
        const size_t candidate_bytes = joined_size_bytes(candidate_lines);

        if (candidate_bytes <= max_bytes)
        {
            best_row_count = mid;
            low = mid + 1;
        }
        else
        {
            // mid >= low >= 2 throughout, so this cannot underflow
            high = mid - 1;
        }
    }

    const std::vector<size_t> best_row_indices =
        select_downsample_indices(data_points, best_row_count);
    return keep_selected_rows(input_lines, data_line_positions, best_row_indices);
}
} // namespace utils
} // namespace jaiabot

#endif // JAIABOT_UTILS_DOWNSAMPLE_H

#ifndef JAIABOT_UTILS_DOWNSAMPLE_H
#define JAIABOT_UTILS_DOWNSAMPLE_H

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <sstream>
#include <string>
#include <vector>

namespace jaiabot
{
namespace utils
{

struct Point
{
    double x;
    double y;
};

// Select representative point indices that preserve overall curve shape.
inline std::vector<size_t> downsampleIndices(const std::vector<Point>& data, size_t target_size)
{
    if (data.empty())
    {
        return {};
    }

    if (target_size >= data.size())
    {
        std::vector<size_t> all_indices;
        all_indices.reserve(data.size());
        for (size_t i = 0; i < data.size(); ++i) { all_indices.push_back(i); }
        return all_indices;
    }

    if (target_size <= 2)
    {
        return {0, data.size() - 1};
    }

    std::vector<size_t> selected_indices;
    selected_indices.reserve(target_size);

    const size_t n = data.size();
    const double bucket_size = static_cast<double>(n - 2) / static_cast<double>(target_size - 2);

    selected_indices.push_back(0);
    size_t a_index = 0;

    for (size_t i = 0; i < target_size - 2; ++i)
    {
        size_t c_start = static_cast<size_t>(std::floor((i + 1) * bucket_size)) + 1;
        size_t c_end = static_cast<size_t>(std::floor((i + 2) * bucket_size)) + 1;
        c_end = std::min(c_end, n);
        c_start = std::min(c_start, n);

        double avg_cx = 0.0;
        double avg_cy = 0.0;
        const size_t c_bucket_size = (c_end > c_start) ? (c_end - c_start) : 0;

        for (size_t c = c_start; c < c_end; ++c)
        {
            avg_cx += data[c].x;
            avg_cy += data[c].y;
        }

        if (c_bucket_size > 0)
        {
            avg_cx /= static_cast<double>(c_bucket_size);
            avg_cy /= static_cast<double>(c_bucket_size);
        }
        else
        {
            avg_cx = data[a_index].x;
            avg_cy = data[a_index].y;
        }

        size_t b_start = static_cast<size_t>(std::floor(i * bucket_size)) + 1;
        size_t b_end = static_cast<size_t>(std::floor((i + 1) * bucket_size)) + 1;
        b_start = std::min(b_start, n - 1);
        b_end = std::min(b_end, n - 1);
        if (b_end <= b_start)
        {
            b_end = std::min(b_start + 1, n - 1);
        }

        const Point& point_a = data[a_index];
        double max_area = -1.0;
        size_t next_a_index = b_start;

        for (size_t b = b_start; b < b_end; ++b)
        {
            const double area =
                0.5 * std::abs(point_a.x * (data[b].y - avg_cy) + data[b].x * (avg_cy - point_a.y) +
                               avg_cx * (point_a.y - data[b].y));

            if (area > max_area)
            {
                max_area = area;
                next_a_index = b;
            }
        }

        selected_indices.push_back(next_a_index);
        a_index = next_a_index;
    }

    selected_indices.push_back(n - 1);
    return selected_indices;
}

// Parse a data row into a point using the first and last numeric columns.
inline bool parseDataRow(const std::string& line, Point& point_out)
{
    // Expected row shape: "index value1 value2 ... valueN" where index is integer.
    std::istringstream iss(line);
    long long row_index = 0;
    if (!(iss >> row_index))
    {
        return false;
    }

    std::vector<double> values;
    double value = 0.0;
    while (iss >> value) { values.push_back(value); }

    if (values.size() < 2)
    {
        return false;
    }

    // Use first and last numeric columns as the shape coordinates.
    point_out.x = values.front();
    point_out.y = values.back();
    return true;
}

// Return the byte size of lines when joined with newline separators.
inline size_t joinedSizeBytes(const std::vector<std::string>& lines)
{
    if (lines.empty())
    {
        return 0;
    }

    size_t total = 0;
    for (const std::string& line : lines) { total += line.size(); }

    // Newline separators between lines.
    total += lines.size() - 1;
    return total;
}

// Rebuild output by keeping all metadata lines and selected data rows.
inline std::vector<std::string>
buildOutputWithSelectedRows(const std::vector<std::string>& input_lines,
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

    size_t data_cursor = 0;
    for (size_t line_index = 0; line_index < input_lines.size(); ++line_index)
    {
        if (data_cursor < data_line_positions.size() &&
            data_line_positions[data_cursor] == line_index)
        {
            if (keep_data_row[data_cursor])
            {
                output_lines.push_back(input_lines[line_index]);
            }
            ++data_cursor;
        }
        else
        {
            output_lines.push_back(input_lines[line_index]);
        }
    }

    return output_lines;
}

// Downsample data rows to fit within a maximum serialized byte budget.
inline std::vector<std::string>
downsampleDatasetToMaxBytes(const std::vector<std::string>& input_lines, size_t max_bytes)
{
    std::vector<Point> data_points;
    std::vector<size_t> data_line_positions;
    data_points.reserve(input_lines.size());
    data_line_positions.reserve(input_lines.size());

    for (size_t i = 0; i < input_lines.size(); ++i)
    {
        Point point{};
        if (parseDataRow(input_lines[i], point))
        {
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
    size_t best_size = 2;

    while (low <= high)
    {
        const size_t mid = low + (high - low) / 2;
        const std::vector<size_t> selected_rows = downsampleIndices(data_points, mid);
        const std::vector<std::string> candidate =
            buildOutputWithSelectedRows(input_lines, data_line_positions, selected_rows);
        const size_t candidate_size = joinedSizeBytes(candidate);

        if (candidate_size <= max_bytes)
        {
            best_size = mid;
            low = mid + 1;
        }
        else
        {
            if (mid == 0)
            {
                break;
            }
            high = mid - 1;
        }
    }

    const std::vector<size_t> best_rows = downsampleIndices(data_points, best_size);
    return buildOutputWithSelectedRows(input_lines, data_line_positions, best_rows);
}

} // namespace utils
} // namespace jaiabot

#endif // JAIABOT_UTILS_DOWNSAMPLE_H

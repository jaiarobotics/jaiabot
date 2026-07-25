// Copyright 2025:
//   JaiaRobotics LLC
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_LIB_NAV_LINALG_H
#define JAIABOT_LIB_NAV_LINALG_H

#include <array>
#include <cmath>
#include <cstddef>
#include <optional>

namespace jaiabot
{
namespace nav
{
/// Fixed-size dense matrix, sized for the small Kalman filters in this library.
template <std::size_t Rows, std::size_t Cols> class Matrix
{
  public:
    static constexpr std::size_t rows = Rows;
    static constexpr std::size_t cols = Cols;
    static constexpr bool is_vector = (Cols == 1);

    constexpr Matrix() : d_{} {}

    /// Row-major initialisation, e.g. `Matrix<2,2>({a, b, c, d})`.
    constexpr explicit Matrix(const std::array<double, Rows * Cols>& values) : d_(values) {}

    static constexpr Matrix zero() { return Matrix{}; }

    static constexpr Matrix identity()
        requires(Rows == Cols)
    {
        Matrix m;
        for (std::size_t i = 0; i < Rows; ++i) m(i, i) = 1.0;
        return m;
    }

    /// Diagonal matrix from the given entries.
    static constexpr Matrix diagonal(const std::array<double, Rows>& v)
        requires(Rows == Cols)
    {
        Matrix m;
        for (std::size_t i = 0; i < Rows; ++i) m(i, i) = v[i];
        return m;
    }

    constexpr double& operator()(std::size_t r, std::size_t c) { return d_[r * Cols + c]; }
    constexpr const double& operator()(std::size_t r, std::size_t c) const
    {
        return d_[r * Cols + c];
    }

    constexpr double& operator[](std::size_t i)
        requires is_vector
    {
        return d_[i];
    }
    constexpr const double& operator[](std::size_t i) const
        requires is_vector
    {
        return d_[i];
    }

    constexpr Matrix<Cols, Rows> transpose() const
    {
        Matrix<Cols, Rows> t;
        for (std::size_t r = 0; r < Rows; ++r)
            for (std::size_t c = 0; c < Cols; ++c) t(c, r) = (*this)(r, c);
        return t;
    }

    /// Average of the matrix and its transpose; keeps covariances symmetric.
    constexpr Matrix symmetrised() const
        requires(Rows == Cols)
    {
        Matrix s;
        for (std::size_t r = 0; r < Rows; ++r)
            for (std::size_t c = 0; c < Cols; ++c)
                s(r, c) = 0.5 * ((*this)(r, c) + (*this)(c, r));
        return s;
    }

    constexpr Matrix& operator+=(const Matrix& o)
    {
        for (std::size_t i = 0; i < Rows * Cols; ++i) d_[i] += o.d_[i];
        return *this;
    }

    constexpr Matrix& operator-=(const Matrix& o)
    {
        for (std::size_t i = 0; i < Rows * Cols; ++i) d_[i] -= o.d_[i];
        return *this;
    }

    constexpr Matrix& operator*=(double s)
    {
        for (std::size_t i = 0; i < Rows * Cols; ++i) d_[i] *= s;
        return *this;
    }

    constexpr double squared_norm() const
    {
        double s = 0.0;
        for (std::size_t i = 0; i < Rows * Cols; ++i) s += d_[i] * d_[i];
        return s;
    }

    double norm() const { return std::sqrt(squared_norm()); }

    bool all_finite() const
    {
        for (std::size_t i = 0; i < Rows * Cols; ++i)
            if (!std::isfinite(d_[i])) return false;
        return true;
    }

    /// Contiguous block starting at (r0, c0).
    template <std::size_t R, std::size_t C>
    constexpr Matrix<R, C> block(std::size_t r0, std::size_t c0) const
    {
        Matrix<R, C> b;
        for (std::size_t r = 0; r < R; ++r)
            for (std::size_t c = 0; c < C; ++c) b(r, c) = (*this)(r0 + r, c0 + c);
        return b;
    }

    template <std::size_t R, std::size_t C>
    constexpr void set_block(std::size_t r0, std::size_t c0, const Matrix<R, C>& b)
    {
        for (std::size_t r = 0; r < R; ++r)
            for (std::size_t c = 0; c < C; ++c) (*this)(r0 + r, c0 + c) = b(r, c);
    }

  private:
    std::array<double, Rows * Cols> d_;
};

template <std::size_t N> using Vector = Matrix<N, 1>;
using Vector2 = Vector<2>;
using Vector3 = Vector<3>;
using Matrix2 = Matrix<2, 2>;
using Matrix3 = Matrix<3, 3>;

template <std::size_t R, std::size_t C>
constexpr Matrix<R, C> operator+(Matrix<R, C> a, const Matrix<R, C>& b)
{
    return a += b;
}

template <std::size_t R, std::size_t C>
constexpr Matrix<R, C> operator-(Matrix<R, C> a, const Matrix<R, C>& b)
{
    return a -= b;
}

template <std::size_t R, std::size_t C> constexpr Matrix<R, C> operator-(const Matrix<R, C>& a)
{
    Matrix<R, C> n;
    for (std::size_t r = 0; r < R; ++r)
        for (std::size_t c = 0; c < C; ++c) n(r, c) = -a(r, c);
    return n;
}

template <std::size_t R, std::size_t C> constexpr Matrix<R, C> operator*(Matrix<R, C> a, double s)
{
    return a *= s;
}

template <std::size_t R, std::size_t C> constexpr Matrix<R, C> operator*(double s, Matrix<R, C> a)
{
    return a *= s;
}

template <std::size_t R, std::size_t K, std::size_t C>
constexpr Matrix<R, C> operator*(const Matrix<R, K>& a, const Matrix<K, C>& b)
{
    Matrix<R, C> m;
    for (std::size_t r = 0; r < R; ++r)
        for (std::size_t k = 0; k < K; ++k)
        {
            const double av = a(r, k);
            if (av == 0.0) continue;
            for (std::size_t c = 0; c < C; ++c) m(r, c) += av * b(k, c);
        }
    return m;
}

template <std::size_t N> constexpr double dot(const Vector<N>& a, const Vector<N>& b)
{
    double s = 0.0;
    for (std::size_t i = 0; i < N; ++i) s += a[i] * b[i];
    return s;
}

constexpr Vector3 cross(const Vector3& a, const Vector3& b)
{
    return Vector3({a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                    a[0] * b[1] - a[1] * b[0]});
}

/// Unit vector, or nullopt when the input is too short to normalise reliably.
template <std::size_t N>
std::optional<Vector<N>> normalised(const Vector<N>& v, double min_norm = 1e-9)
{
    const double n = v.norm();
    if (!std::isfinite(n) || n < min_norm) return std::nullopt;
    return v * (1.0 / n);
}

/// Gauss-Jordan inverse with partial pivoting; nullopt when singular.
template <std::size_t N> std::optional<Matrix<N, N>> inverse(const Matrix<N, N>& a)
{
    Matrix<N, N> m = a;
    Matrix<N, N> inv = Matrix<N, N>::identity();

    for (std::size_t col = 0; col < N; ++col)
    {
        std::size_t pivot = col;
        for (std::size_t r = col + 1; r < N; ++r)
            if (std::abs(m(r, col)) > std::abs(m(pivot, col))) pivot = r;

        if (!std::isfinite(m(pivot, col)) || std::abs(m(pivot, col)) < 1e-300)
            return std::nullopt;

        if (pivot != col)
            for (std::size_t c = 0; c < N; ++c)
            {
                std::swap(m(col, c), m(pivot, c));
                std::swap(inv(col, c), inv(pivot, c));
            }

        const double s = 1.0 / m(col, col);
        for (std::size_t c = 0; c < N; ++c)
        {
            m(col, c) *= s;
            inv(col, c) *= s;
        }

        for (std::size_t r = 0; r < N; ++r)
        {
            if (r == col) continue;
            const double f = m(r, col);
            if (f == 0.0) continue;
            for (std::size_t c = 0; c < N; ++c)
            {
                m(r, c) -= f * m(col, c);
                inv(r, c) -= f * inv(col, c);
            }
        }
    }
    return inv;
}

} // namespace nav
} // namespace jaiabot

#endif

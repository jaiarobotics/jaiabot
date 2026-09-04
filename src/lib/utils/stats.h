#ifndef JAIABOT_UTILS_STATS_H
#define JAIABOT_UTILS_STATS_H

#include <boost/circular_buffer.hpp>

#include <boost/accumulators/accumulators.hpp>
#include <boost/accumulators/statistics/mean.hpp>
#include <boost/accumulators/statistics/median.hpp>
#include <boost/accumulators/statistics/variance.hpp>

#include <boost/units/cmath.hpp>
#include <boost/units/io.hpp>

namespace jaiabot
{
namespace utils
{

enum class VarianceNorm
{
    UNBIASED,
    BIASED
};

template <typename Quantity> class RollingStatsAccumulator;

template <typename Quantity>
inline std::ostream& operator<<(std::ostream& os, const RollingStatsAccumulator<Quantity>& acc)
{
    os << "RollingStatsAccumulator {\n";

    os << "  size      : " << acc.size() << "\n";
    os << "  capacity  : " << acc.buf_.capacity() << "\n";

    os << "  values    : [";
    for (std::size_t i = 0; i < acc.buf_.size(); ++i)
    {
        if (i > 0)
            os << ", ";
        os << Quantity::from_value(acc.buf_[i]);
    }
    os << "]\n";

    if (acc.buf_.empty())
    {
        os << "  stats     : <empty>\n";
    }
    else
    {
        os << "  stats     :\n";
        os << "    μ      = " << acc.mean() << "\n";
        os << "    med    = " << acc.median() << "\n";
        os << "    min    = " << acc.min() << "\n";
        os << "    max    = " << acc.max() << "\n";
        os << "    σ (N-1) = " << acc.stddev(VarianceNorm::UNBIASED) << "\n";
        os << "    σ (N)   = " << acc.stddev(VarianceNorm::BIASED) << "\n";
        os << "    σ² (N-1)      = " << acc.variance(VarianceNorm::UNBIASED) << "\n";
        os << "    σ² (N)      = " << acc.variance(VarianceNorm::BIASED) << "\n";
    }

    os << "}";

    return os;
}

/// \brief Maintains a circular buffer of n samples of some boost::units::quantity and allows for computation of statistics on the contents of this buffer
template <typename Quantity> class RollingStatsAccumulator
{
  public:
    /// \brief Constructor
    ///
    /// \param n Number of samples to maintain
    RollingStatsAccumulator(std::size_t n) : buf_(n) {}

    void push_back(const Quantity& v) { buf_.push_back(v.value()); }
    void operator()(const Quantity& v) { push_back(v); }

    using value_type = typename Quantity::value_type;
    using unit_type = typename Quantity::unit_type;
    using unit2_type = typename boost::units::multiply_typeof_helper<unit_type, unit_type>::type;
    using QuantitySquared = boost::units::quantity<unit2_type, value_type>;

    std::size_t size() const { return buf_.size(); }
    std::size_t n() const { return size(); }

    Quantity mean() const { return extract<boost::accumulators::tag::mean, Quantity>(); }
    Quantity μ() const { return mean(); }

    Quantity median() const
    {
        if (buf_.empty())
            throw std::runtime_error("No values in RollingStatsAccumulator");
        std::vector<typename Quantity::value_type> v(buf_.begin(), buf_.end());
        std::sort(v.begin(), v.end());
        const std::size_t n = v.size();
        if (n % 2 == 1)
            return Quantity::from_value(v[n / 2]);
        else
            return Quantity::from_value((v[n / 2 - 1] + v[n / 2]) / 2);
    }

    /// \brief Variance
    ///
    /// \param norm If UNBIASED, normalize with N-1; if BIASED normalize with N
    QuantitySquared variance(VarianceNorm norm = VarianceNorm::UNBIASED) const
    {
        auto biased_var = extract<boost::accumulators::tag::variance, QuantitySquared>();
        value_type n = size();
        if (norm == VarianceNorm::UNBIASED && n > 1)
        {
            return (n / (n - 1)) * biased_var;
        }
        else
        {
            return biased_var;
        }
    }
    QuantitySquared σ2(VarianceNorm norm = VarianceNorm::UNBIASED) const { return variance(norm); }

    /// \brief Standard deviation
    ///
    /// \param norm If UNBIASED, normalize with N-1; if BIASED normalize with N
    Quantity stddev(VarianceNorm norm = VarianceNorm::UNBIASED) const
    {
        return boost::units::sqrt(variance(norm));
    }
    Quantity σ(VarianceNorm norm = VarianceNorm::UNBIASED) const { return stddev(norm); }

    Quantity min() const { return extract<boost::accumulators::tag::min, Quantity>(); }
    Quantity max() const { return extract<boost::accumulators::tag::max, Quantity>(); }

    friend std::ostream& operator<< <>(std::ostream&, const RollingStatsAccumulator&);

  private:
    template <typename Tag, typename ReturnQuantity> ReturnQuantity extract() const
    {
        if (buf_.empty())
            throw(std::runtime_error("No values in RollingStatsAccumulator"));

        namespace ba = boost::accumulators;
        ba::accumulator_set<typename Quantity::value_type, ba::features<Tag>> a;
        std::for_each(buf_.begin(), buf_.end(), std::bind(std::ref(a), std::placeholders::_1));
        auto result = ba::extract_result<Tag>(a);
        return ReturnQuantity::from_value(result);
    }

  private:
    boost::circular_buffer<typename Quantity::value_type> buf_;
};

} // namespace utils
} // namespace jaiabot

#endif

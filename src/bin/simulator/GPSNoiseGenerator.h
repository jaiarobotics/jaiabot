#include <random>
#include "jaiabot/messages/simulator.pb.h"


using jaiabot::protobuf::GPSNoise;


struct GPSNoiseGenerator {
    GPSNoiseGenerator(const GPSNoise& gps_noise) {
        set_noise_params(gps_noise);
    }

    void set_noise_params(const GPSNoise& gps_noise) {
        config = gps_noise;
        last_noise_x_ = 0.0;
        last_noise_y_ = 0.0;
    }

    std::pair<double, double> generate() {

        // We're using an AR(1) process to model temporally correlated GPS noise
        const double lateral_stdev = config.lateral_r95() / 1.96;  // R95 to 1 sigma
        const double lateral_phi = config.lateral_phi();
        // Calculate the standard deviation of the epsilon term
        const double sigma_epsilon =
            lateral_stdev * std::sqrt(1 - lateral_phi * lateral_phi);
        auto gps_noise_distribution_ = std::normal_distribution<double>(0.0, sigma_epsilon);

        double x_noise = lateral_phi * last_noise_x_ + gps_noise_distribution_(generator_);
        double y_noise = lateral_phi * last_noise_y_ + gps_noise_distribution_(generator_);
        last_noise_x_ = x_noise;
        last_noise_y_ = y_noise;

        // Set the hdop and pdop values to match the noise characteristics
        hdop = (lateral_stdev * std::sqrt(2)) / 5.0;  // assuming vertical stdev is half of horizontal
        pdop = hdop;

        return {x_noise, y_noise};
    }

  public:
    GPSNoise config;
    double hdop, pdop;

  private:
    std::default_random_engine generator_;
    double last_noise_x_;
    double last_noise_y_;
};

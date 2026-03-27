// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   JaiaRobotics
//
// This file is part of the JaiaBot Hydro Project Binaries.
// The Jaia Binaries are distributed under the terms of the GNU General Public License.

#include <atomic>
#include <chrono>
#include <cmath>
#include <mutex>
#include <optional>
#include <queue>
#include <thread>

#include <boost/asio.hpp>

#include <opencv2/core.hpp>
#include <opencv2/dnn.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/videoio.hpp>

#include <onnxruntime_cxx_api.h>

#include <goby/middleware/marshalling/protobuf.h>
#include <goby/util/constants.h>
#include <goby/zeromq/application/single_thread.h>

#include <ByteTrack/BYTETracker.h>

// termios defines ECHO as a macro which conflicts with the protobuf-generated BotType enum
#ifdef ECHO
#undef ECHO
#endif

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/obstacle.pb.h"

using goby::glog;
using namespace std;

namespace ba = boost::asio;
using tcp = ba::ip::tcp;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;

constexpr double DEG_TO_RAD = M_PI / 180.0;
constexpr size_t MAX_DETECTION_QUEUE_SIZE = 10;

namespace jaiabot
{
namespace apps
{

struct Detection
{
    float x1, y1, x2, y2;
    float confidence;
    int class_id;
};

// Annotation data produced by inference thread, consumed by capture/display thread
struct TrackAnnotation
{
    int x1, y1, x2, y2;
    int track_id;
    float confidence;
    float dist_m{-1.f}; // forward distance estimate, -1 if unknown
};

// ---------------------------------------------------------------------------
// YOLO ONNX Detector
// ---------------------------------------------------------------------------
class YOLODetector
{
  public:
    YOLODetector(const std::string& model_path, int infer_size, float conf_thresh,
                 float nms_thresh, int nm)
        : session_(env_, model_path.c_str(), Ort::SessionOptions()),
          infer_size_(infer_size),
          conf_thresh_(conf_thresh),
          nms_thresh_(nms_thresh),
          nm_(nm)
    {
        for (size_t i = 0; i < session_.GetInputCount(); i++)
        {
            input_name_ptrs_.push_back(session_.GetInputNameAllocated(i, allocator_));
            input_names_.push_back(input_name_ptrs_.back().get());
        }
        for (size_t i = 0; i < session_.GetOutputCount(); i++)
        {
            output_name_ptrs_.push_back(session_.GetOutputNameAllocated(i, allocator_));
            output_names_.push_back(output_name_ptrs_.back().get());
        }
    }

    std::vector<Detection> run(const cv::Mat& bgr_frame)
    {
        int orig_w = bgr_frame.cols;
        int orig_h = bgr_frame.rows;

        // Letterbox: scale uniformly to fit infer_size, pad remainder with grey (114)
        // Matches ultralytics default preprocessing used during training
        float scale = std::min((float)infer_size_ / orig_w, (float)infer_size_ / orig_h);
        int scaled_w = static_cast<int>(orig_w * scale);
        int scaled_h = static_cast<int>(orig_h * scale);
        int pad_x = (infer_size_ - scaled_w) / 2;
        int pad_y = (infer_size_ - scaled_h) / 2;

        cv::Mat scaled;
        cv::resize(bgr_frame, scaled, {scaled_w, scaled_h});
        cv::Mat letterboxed(infer_size_, infer_size_, bgr_frame.type(), cv::Scalar(114, 114, 114));
        scaled.copyTo(letterboxed(cv::Rect(pad_x, pad_y, scaled_w, scaled_h)));

        cv::Mat rgb;
        cv::cvtColor(letterboxed, rgb, cv::COLOR_BGR2RGB);
        cv::Mat float_img;
        rgb.convertTo(float_img, CV_32F, 1.0 / 255.0);

        std::vector<cv::Mat> channels(3);
        cv::split(float_img, channels);
        std::vector<float> input_data;
        input_data.reserve(3 * infer_size_ * infer_size_);
        for (auto& ch : channels)
            input_data.insert(input_data.end(), (float*)ch.data,
                              (float*)ch.data + ch.total());

        std::array<int64_t, 4> input_shape{1, 3, infer_size_, infer_size_};
        auto memory_info = Ort::MemoryInfo::CreateCpu(OrtDeviceAllocator, OrtMemTypeCPU);
        Ort::Value input_tensor = Ort::Value::CreateTensor<float>(
            memory_info, input_data.data(), input_data.size(), input_shape.data(),
            input_shape.size());

        auto outputs =
            session_.Run(Ort::RunOptions{nullptr}, input_names_.data(), &input_tensor, 1,
                         output_names_.data(), output_names_.size());

        int nm = nm_;
        if (outputs.size() > 1)
        {
            auto shape1 = outputs[1].GetTensorTypeAndShapeInfo().GetShape();
            if (shape1.size() >= 2)
                nm = (int)shape1[1];
        }

        auto shape = outputs[0].GetTensorTypeAndShapeInfo().GetShape();
        const float* data = outputs[0].GetTensorData<float>();
        int64_t dim1 = shape[1], dim2 = shape[2];

        int features, num_proposals;
        bool transposed;
        if (dim1 <= dim2) { features = (int)dim1; num_proposals = (int)dim2; transposed = false; }
        else { num_proposals = (int)dim1; features = (int)dim2; transposed = true; }

        int nc = features - 4 - nm;
        if (nc <= 0) nc = 1;

        auto get = [&](int proposal_idx, int feat_idx) -> float {
            if (transposed) return data[proposal_idx * features + feat_idx];
            else return data[feat_idx * num_proposals + proposal_idx];
        };

        std::vector<cv::Rect2d> boxes;
        std::vector<float> confidences;
        std::vector<int> class_ids;

        for (int i = 0; i < num_proposals; i++)
        {
            float cx = get(i, 0); float cy = get(i, 1); float w = get(i, 2); float h = get(i, 3);
            float max_conf = 0.0f; int max_class = 0;
            for (int c = 0; c < nc; c++)
            {
                float conf = get(i, 4 + c);
                if (conf > max_conf) { max_conf = conf; max_class = c; }
            }
            if (max_conf >= conf_thresh_)
            {
                boxes.push_back({cx - w / 2.0, cy - h / 2.0, (double)w, (double)h});
                confidences.push_back(max_conf);
                class_ids.push_back(max_class);
            }
        }

        std::vector<int> indices;
        cv::dnn::NMSBoxes(boxes, confidences, conf_thresh_, nms_thresh_, indices);

        std::vector<Detection> dets;
        for (int idx : indices)
        {
            Detection d;
            // Remove letterbox padding then undo the uniform scale
            d.x1 = (boxes[idx].x - pad_x) / scale;
            d.y1 = (boxes[idx].y - pad_y) / scale;
            d.x2 = (boxes[idx].x + boxes[idx].width - pad_x) / scale;
            d.y2 = (boxes[idx].y + boxes[idx].height - pad_y) / scale;
            d.confidence = confidences[idx];
            d.class_id = class_ids[idx];
            dets.push_back(d);
        }
        return dets;
    }

  private:
    Ort::Env env_{ORT_LOGGING_LEVEL_WARNING, "YOLODetector"};
    Ort::Session session_;
    Ort::AllocatorWithDefaultOptions allocator_;
    int infer_size_;
    float conf_thresh_;
    float nms_thresh_;
    int nm_;
    std::vector<const char*> input_names_;
    std::vector<const char*> output_names_;
    std::vector<Ort::AllocatedStringPtr> input_name_ptrs_;
    std::vector<Ort::AllocatedStringPtr> output_name_ptrs_;
};

// ---------------------------------------------------------------------------
// MJPEG HTTP server — one thread per client
// ---------------------------------------------------------------------------
class MJPEGServer
{
  public:
    explicit MJPEGServer(uint16_t port) : port_(port)
    {
        server_thread_ = std::thread(&MJPEGServer::run, this);
    }

    ~MJPEGServer()
    {
        running_ = false;
        frame_cv_.notify_all();
        if (server_thread_.joinable()) server_thread_.join();
    }

    void push_frame(const std::vector<uint8_t>& jpeg)
    {
        {
            std::lock_guard<std::mutex> lock(frame_mutex_);
            latest_frame_ = jpeg;
            frame_ready_ = true;
        }
        frame_cv_.notify_all();
    }

    int client_count() const { return client_count_.load(); }

  private:
    void run()
    {
        ba::io_context io;
        tcp::acceptor acceptor(io, {tcp::v4(), port_});
        acceptor.non_blocking(true);

        while (running_)
        {
            tcp::socket sock(io);
            boost::system::error_code ec;
            acceptor.accept(sock, ec);
            if (ec == ba::error::would_block)
            {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                continue;
            }
            if (ec || !running_) break;

            ++client_count_;
            std::thread([this, s = std::move(sock)]() mutable {
                handle_client(std::move(s));
                --client_count_;
            }).detach();
        }
    }

    void handle_client(tcp::socket sock)
    {
        ba::streambuf req_buf;
        boost::system::error_code ec;
        ba::read_until(sock, req_buf, "\r\n\r\n", ec);
        if (ec) return;

        std::istream req_stream(&req_buf);
        std::string first_line;
        std::getline(req_stream, first_line);

        if (first_line.find("/video_feed") == std::string::npos)
        {
            std::string html =
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n"
                "<html><head><title>JaiaBot Vision</title>"
                "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                "<style>"
                "*{box-sizing:border-box;margin:0;padding:0}"
                "html,body{width:100%;height:100%;background:#000;overflow:hidden}"
                "img{position:fixed;top:0;left:0;width:100%;height:100%;object-fit:contain}"
                "</style></head>"
                "<body><img src='/video_feed'></body></html>";
            ba::write(sock, ba::buffer(html), ec);
            return;
        }

        std::string headers =
            "HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace; "
            "boundary=frame\r\nCache-Control: no-cache\r\n\r\n";
        ba::write(sock, ba::buffer(headers), ec);

        while (running_)
        {
            std::unique_lock<std::mutex> lock(frame_mutex_);
            frame_cv_.wait(lock, [this] { return frame_ready_ || !running_; });
            if (!running_) break;
            std::vector<uint8_t> jpeg = latest_frame_;
            frame_ready_ = false;
            lock.unlock();

            std::string frame_hdr = "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " +
                                    std::to_string(jpeg.size()) + "\r\n\r\n";
            ba::write(sock, ba::buffer(frame_hdr), ec);
            if (ec) break;
            ba::write(sock, ba::buffer(jpeg), ec);
            if (ec) break;
            ba::write(sock, ba::buffer(std::string("\r\n")), ec);
            if (ec) break;
        }
    }

    uint16_t port_;
    std::thread server_thread_;
    std::mutex frame_mutex_;
    std::condition_variable frame_cv_;
    std::vector<uint8_t> latest_frame_;
    bool frame_ready_{false};
    std::atomic<bool> running_{true};
    std::atomic<int> client_count_{0};
};

// ---------------------------------------------------------------------------
// Main application: ObstacleDetector
// ---------------------------------------------------------------------------
class ObstacleDetector : public zeromq::SingleThreadApplication<config::ObstacleDetector>
{
  public:
    ObstacleDetector();
    ~ObstacleDetector();

  private:
    void loop() override;
    std::optional<std::pair<double, double>> pixel_to_local(double u, double v);
    cv::VideoCapture open_camera();
    void capture_thread_func();
    void inference_thread_func();

    static cv::Scalar confidence_color(float conf);
    static void draw_bracket_box(cv::Mat& img, cv::Rect r, cv::Scalar color, int thickness = 2);
    static void draw_label_bg(cv::Mat& img, const std::string& text, cv::Point org,
                              double scale, cv::Scalar fg, cv::Scalar bg);

  private:
    std::mutex detection_queue_mutex_;
    std::queue<jaiabot::protobuf::Obstacles> detection_queue_;

    // Inference results shared with capture/display thread
    std::mutex tracks_mutex_;
    std::vector<TrackAnnotation> current_tracks_;

    // Latest camera frame shared with inference thread
    std::mutex capture_frame_mutex_;
    cv::Mat capture_latest_frame_;
    bool capture_frame_ready_{false};
    std::condition_variable capture_frame_cv_;

    std::thread capture_thread_;
    std::thread inference_thread_;
    std::atomic<bool> running_{true};
    std::unique_ptr<MJPEGServer> mjpeg_server_;

    std::atomic<int> capture_fps_{0};
    std::atomic<int> inference_fps_{0};

    // IMU pitch (bow-up positive, degrees) — negative contribution to cam_angle_deg
    std::atomic<double> imu_pitch_deg_{0.0};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::ObstacleDetector>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::ObstacleDetector>(argc, argv));
}

// ---------------------------------------------------------------------------
// ObstacleDetector implementation
// ---------------------------------------------------------------------------

jaiabot::apps::ObstacleDetector::ObstacleDetector()
    : zeromq::SingleThreadApplication<config::ObstacleDetector>(1.0 * boost::units::si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("camera", goby::util::Colors::blue);

    interprocess().subscribe<groups::imu>([this](const protobuf::IMUData& imu_data) {
        if (imu_data.has_euler_angles() && imu_data.euler_angles().has_pitch())
            imu_pitch_deg_.store(imu_data.euler_angles().pitch());
    });

    mjpeg_server_ = std::make_unique<MJPEGServer>((uint16_t)cfg().http_port());
    capture_thread_ = std::thread(&ObstacleDetector::capture_thread_func, this);
    inference_thread_ = std::thread(&ObstacleDetector::inference_thread_func, this);
}

jaiabot::apps::ObstacleDetector::~ObstacleDetector()
{
    running_ = false;
    capture_frame_cv_.notify_all();
    if (capture_thread_.joinable()) capture_thread_.join();
    if (inference_thread_.joinable()) inference_thread_.join();
}

void jaiabot::apps::ObstacleDetector::loop()
{
    std::lock_guard<std::mutex> lock(detection_queue_mutex_);
    while (!detection_queue_.empty())
    {
        interprocess().publish<groups::obstacle_detector>(detection_queue_.front());
        detection_queue_.pop();
    }
}

std::optional<std::pair<double, double>>
jaiabot::apps::ObstacleDetector::pixel_to_local(double u, double v)
{
    double img_w = cfg().image_width(); double img_h = cfg().image_height();
    double fov_h = cfg().fov_horizontal_deg(); double cam_angle = cfg().cam_angle_deg();
    double cam_height = cfg().cam_height_m();

    double cx = u - (img_w / 2.0);
    double cy = v - (img_h / 2.0); // positive = below center = larger downward angle = closer

    double fov_v = fov_h * (img_h / img_w);
    double alpha_v = (cy / (img_h / 2.0)) * (fov_v / 2.0);
    // Subtract IMU pitch: bow-up tilt (positive pitch) tilts camera upward (reduces effective downward angle)
    double effective_cam_angle = cam_angle - imu_pitch_deg_.load();
    double total_angle_rad = (effective_cam_angle + alpha_v) * DEG_TO_RAD;

    if (total_angle_rad <= 0.05) return std::nullopt;

    double dist_f = cam_height / std::tan(total_angle_rad);
    double alpha_h = (cx / (img_w / 2.0)) * (fov_h / 2.0);
    double dist_l = dist_f * std::tan(alpha_h * DEG_TO_RAD);

    return std::make_pair(dist_f, dist_l);
}

cv::VideoCapture jaiabot::apps::ObstacleDetector::open_camera()
{
    int cam_idx = cfg().camera_index();
    if (cam_idx >= 0) {
        cv::VideoCapture cap(cam_idx, cv::CAP_V4L2);
        if (cap.isOpened()) { cv::Mat test; if (cap.read(test)) return cap; }
        return cv::VideoCapture();
    }
    for (int i = 0; i < 5; i++) {
        cv::VideoCapture cap(i, cv::CAP_V4L2);
        if (cap.isOpened()) { cv::Mat test; if (cap.read(test)) return cap; }
        cap.release();
    }
    return cv::VideoCapture();
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

cv::Scalar jaiabot::apps::ObstacleDetector::confidence_color(float conf)
{
    if (conf >= 0.7f) return {0, 220, 0};   // green
    if (conf >= 0.4f) return {0, 180, 255}; // amber
    return {0, 60, 255};                    // red
}

void jaiabot::apps::ObstacleDetector::draw_bracket_box(cv::Mat& img, cv::Rect r,
                                                        cv::Scalar color, int thickness)
{
    int len = std::max(std::min({r.width, r.height, 20}) / 3, 8);
    cv::Point tl = r.tl();
    cv::Point tr(r.x + r.width, r.y);
    cv::Point bl(r.x, r.y + r.height);
    cv::Point br = r.br();

    cv::line(img, tl, tl + cv::Point(len, 0), color, thickness);
    cv::line(img, tl, tl + cv::Point(0, len), color, thickness);
    cv::line(img, tr, tr + cv::Point(-len, 0), color, thickness);
    cv::line(img, tr, tr + cv::Point(0, len), color, thickness);
    cv::line(img, bl, bl + cv::Point(len, 0), color, thickness);
    cv::line(img, bl, bl + cv::Point(0, -len), color, thickness);
    cv::line(img, br, br + cv::Point(-len, 0), color, thickness);
    cv::line(img, br, br + cv::Point(0, -len), color, thickness);
}

void jaiabot::apps::ObstacleDetector::draw_label_bg(cv::Mat& img, const std::string& text,
                                                     cv::Point org, double scale,
                                                     cv::Scalar fg, cv::Scalar bg)
{
    int baseline = 0;
    auto sz = cv::getTextSize(text, cv::FONT_HERSHEY_SIMPLEX, scale, 1, &baseline);
    cv::rectangle(img, org + cv::Point(0, baseline + 2),
                  org + cv::Point(sz.width + 4, -sz.height - 2), bg, cv::FILLED);
    cv::putText(img, text, org + cv::Point(2, 0), cv::FONT_HERSHEY_SIMPLEX, scale, fg, 1);
}

// ---------------------------------------------------------------------------
// Capture thread: reads frames at camera speed, drives display
// ---------------------------------------------------------------------------

void jaiabot::apps::ObstacleDetector::capture_thread_func()
{
    glog.is_verbose() && glog << group("camera") << "Capture thread started" << std::endl;

    // Retry loop: keep trying until camera opens or app shuts down
    cv::VideoCapture cap;
    while (running_ && !cap.isOpened())
    {
        cap = open_camera();
        if (!cap.isOpened())
        {
            glog.is_warn() && glog << group("camera")
                                   << "Camera not available, retrying in 2s..." << std::endl;
            std::this_thread::sleep_for(std::chrono::seconds(2));
        }
    }
    if (!running_) return;

    cap.set(cv::CAP_PROP_FRAME_WIDTH, cfg().image_width());
    cap.set(cv::CAP_PROP_FRAME_HEIGHT, cfg().image_height());
    cap.set(cv::CAP_PROP_BUFFERSIZE, 1);

    glog.is_verbose() && glog << group("camera") << "Camera opened" << std::endl;

    auto prev_time = std::chrono::steady_clock::now();

    while (running_)
    {
        cv::Mat frame;
        if (!cap.read(frame))
        {
            glog.is_warn() && glog << group("camera")
                                   << "Camera read failed, reconnecting..." << std::endl;
            cap.release();
            std::this_thread::sleep_for(std::chrono::seconds(2));
            cap = open_camera();
            continue;
        }

        // Update capture FPS
        auto now = std::chrono::steady_clock::now();
        capture_fps_.store(
            static_cast<int>(1.0 / std::chrono::duration<double>(now - prev_time).count()));
        prev_time = now;

        // Signal inference thread with the latest frame
        {
            std::lock_guard<std::mutex> lock(capture_frame_mutex_);
            capture_latest_frame_ = frame;
            capture_frame_ready_ = true;
        }
        capture_frame_cv_.notify_one();

        // Build display frame annotated with latest inference results
        cv::Mat display = frame.clone();

        std::vector<TrackAnnotation> tracks;
        {
            std::lock_guard<std::mutex> lock(tracks_mutex_);
            tracks = current_tracks_;
        }

        int W = display.cols, H = display.rows;

        // Semi-transparent filled overlay per detection, drawn before brackets
        if (!tracks.empty())
        {
            cv::Mat overlay = display.clone();
            for (const auto& t : tracks)
            {
                int rx1 = std::max(t.x1, 0), ry1 = std::max(t.y1, 0);
                int rx2 = std::min(t.x2, W), ry2 = std::min(t.y2, H);
                if (rx2 <= rx1 || ry2 <= ry1) continue;
                cv::Rect r(rx1, ry1, rx2 - rx1, ry2 - ry1);
                auto color = confidence_color(t.confidence);
                cv::rectangle(overlay, r, color, cv::FILLED);
            }
            cv::addWeighted(overlay, 0.15, display, 0.85, 0, display);
        }

        for (const auto& t : tracks)
        {
            int rx1 = std::max(t.x1, 0), ry1 = std::max(t.y1, 0);
            int rx2 = std::min(t.x2, W), ry2 = std::min(t.y2, H);
            if (rx2 <= rx1 || ry2 <= ry1) continue;
            cv::Rect r(rx1, ry1, rx2 - rx1, ry2 - ry1);
            auto color = confidence_color(t.confidence);
            // Full rectangle outline + bracket corners for visibility
            cv::rectangle(display, r, color * 0.5, 1);
            draw_bracket_box(display, r, color, 3);

            std::string label = "#" + std::to_string(t.track_id);
            label += "  " + std::to_string(static_cast<int>(t.confidence * 100)) + "%";
            if (t.dist_m >= 0.f)
                label += "  " + std::to_string(static_cast<int>(t.dist_m)) + "m";

            draw_label_bg(display, label, {rx1, std::max(ry1 - 4, 0)}, 0.55, color, {20, 20, 20});

            // Distance bar: horizontal bar below the box whose width represents proximity.
            // Full width = 0m (right on top of bot), zero width = max_dist_m or beyond.
            if (t.dist_m >= 0.f)
            {
                constexpr float max_dist_m = 25.f; // matches pObstacleMgr alert_range
                float proximity = 1.f - std::min(t.dist_m / max_dist_m, 1.f); // 1=close, 0=far
                int bar_y = std::min(ry2 + 4, H - 6);
                int bar_w = static_cast<int>((rx2 - rx1) * proximity);
                int bar_x = rx1 + (rx2 - rx1 - bar_w) / 2; // centered under box
                if (bar_w > 2)
                {
                    cv::rectangle(display, {bar_x, bar_y, bar_w, 5}, color, cv::FILLED);
                    cv::rectangle(display, {rx1, bar_y, rx2 - rx1, 5}, {60, 60, 60}, 1);
                }
                // Large distance readout centered inside the box
                std::string dist_str = std::to_string(static_cast<int>(t.dist_m)) + "m";
                int dbline = 0;
                auto dsz = cv::getTextSize(dist_str, cv::FONT_HERSHEY_SIMPLEX, 0.9, 2, &dbline);
                int dx = rx1 + (rx2 - rx1 - dsz.width) / 2;
                int dy = ry1 + (ry2 - ry1 + dsz.height) / 2;
                cv::putText(display, dist_str, {dx, dy}, cv::FONT_HERSHEY_SIMPLEX, 0.9,
                            {20, 20, 20}, 4); // dark shadow
                cv::putText(display, dist_str, {dx, dy}, cv::FONT_HERSHEY_SIMPLEX, 0.9,
                            color, 2);
            }
        }

        // Semi-transparent top status bar
        int bar_h = tracks.empty() ? 36 : 42;
        {
            cv::Mat roi = display(cv::Rect(0, 0, W, bar_h));
            cv::Scalar bar_color = tracks.empty() ? cv::Scalar(0, 0, 0) : cv::Scalar(0, 0, 160);
            cv::Mat dark(bar_h, W, display.type(), bar_color);
            cv::addWeighted(dark, 0.7, roi, 0.3, 0, roi);
        }

        // Left: FPS
        std::string fps_str = "CAM " + std::to_string(capture_fps_.load()) +
                              " | INF " + std::to_string(inference_fps_.load()) + " fps";
        cv::putText(display, fps_str, {8, 26}, cv::FONT_HERSHEY_SIMPLEX, 0.52, {210, 210, 210}, 1);

        // Center: obstacle count — large and colored when active
        std::string cnt_str = tracks.empty()
            ? "No obstacles"
            : "! " + std::to_string(tracks.size()) +
              (tracks.size() == 1 ? " OBSTACLE" : " OBSTACLES") + " !";
        cv::Scalar cnt_color = tracks.empty() ? cv::Scalar(180, 180, 180) : cv::Scalar(80, 80, 255);
        double cnt_scale = tracks.empty() ? 0.52 : 0.65;
        int cnt_thickness = tracks.empty() ? 1 : 2;
        int bl = 0;
        auto cnt_sz = cv::getTextSize(cnt_str, cv::FONT_HERSHEY_SIMPLEX, cnt_scale, cnt_thickness, &bl);
        cv::putText(display, cnt_str, {(W - cnt_sz.width) / 2, 28},
                    cv::FONT_HERSHEY_SIMPLEX, cnt_scale, cnt_color, cnt_thickness);

        // Bottom-right: viewer count (when someone is connected)
        int clients = mjpeg_server_->client_count();
        if (clients > 0)
        {
            std::string cli_str =
                std::to_string(clients) + (clients == 1 ? " viewer" : " viewers");
            draw_label_bg(display, cli_str, {W - 90, H - 8}, 0.44, {180, 180, 180}, {20, 20, 20});
        }

        std::vector<uint8_t> jpeg_buf;
        cv::imencode(".jpg", display, jpeg_buf);
        mjpeg_server_->push_frame(jpeg_buf);
    }
}

// ---------------------------------------------------------------------------
// Inference thread: ONNX + ByteTrack, updates shared track state
// ---------------------------------------------------------------------------

void jaiabot::apps::ObstacleDetector::inference_thread_func()
{
    glog.is_verbose() && glog << group("main")
                              << "Inference thread started, loading model from "
                              << cfg().model_path() << std::endl;

    try
    {
        YOLODetector detector(cfg().model_path(), cfg().inference_size(),
                              cfg().confidence_threshold(), cfg().nms_threshold(),
                              cfg().num_mask_coefficients());

        byte_track::BYTETracker tracker;

        auto prev_time = std::chrono::steady_clock::now();

        while (running_)
        {
            // Wait for a new frame from the capture thread
            cv::Mat frame;
            {
                std::unique_lock<std::mutex> lock(capture_frame_mutex_);
                capture_frame_cv_.wait(lock,
                    [this] { return capture_frame_ready_ || !running_; });
                if (!running_) break;
                frame = capture_latest_frame_.clone();
                capture_frame_ready_ = false;
            }

            auto raw_dets = detector.run(frame);

            std::vector<byte_track::Object> bt_objects;
            for (const auto& det : raw_dets)
                bt_objects.emplace_back(
                    byte_track::Rect<float>(det.x1, det.y1, det.x2 - det.x1, det.y2 - det.y1),
                    det.class_id, det.confidence);
            auto tracks = tracker.update(bt_objects);

            // Update inference FPS
            auto now = std::chrono::steady_clock::now();
            inference_fps_.store(
                static_cast<int>(1.0 / std::chrono::duration<double>(now - prev_time).count()));
            prev_time = now;

            std::vector<TrackAnnotation> new_tracks;
            jaiabot::protobuf::Obstacles obstacle_dets;
            obstacle_dets.set_time(std::chrono::duration_cast<std::chrono::microseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());

            for (const auto& track : tracks)
            {
                const auto& r = track->getRect();
                TrackAnnotation ann;
                ann.x1 = static_cast<int>(r.tl_x());
                ann.y1 = static_cast<int>(r.tl_y());
                ann.x2 = static_cast<int>(r.br_x());
                ann.y2 = static_cast<int>(r.br_y());
                ann.track_id = static_cast<int>(track->getTrackId());
                ann.confidence = track->getScore();

                float x_mid = (ann.x1 + ann.x2) * 0.5f;
                float y_bottom = static_cast<float>(ann.y2);
                auto local = pixel_to_local(x_mid, y_bottom);
                if (local)
                    ann.dist_m = static_cast<float>(local->first);

                new_tracks.push_back(ann);

                // Publish local offsets — gateway transforms to absolute MOOS X/Y
                // using NAV_X/NAV_Y/NAV_HEADING.
                if (local)
                {
                    auto* proto_det = obstacle_dets.add_detection();
                    proto_det->set_local_x(local->first);
                    proto_det->set_local_y(local->second);
                    proto_det->set_confidence(track->getScore());
                    proto_det->set_track_id(static_cast<int32_t>(track->getTrackId()));
                }
            }

            // Update shared track annotations for the display thread
            {
                std::lock_guard<std::mutex> lock(tracks_mutex_);
                current_tracks_ = std::move(new_tracks);
            }

            // Publish detections — drop oldest if queue is full
            if (obstacle_dets.detection_size() > 0)
            {
                std::lock_guard<std::mutex> lock(detection_queue_mutex_);
                if (detection_queue_.size() >= MAX_DETECTION_QUEUE_SIZE)
                    detection_queue_.pop();
                detection_queue_.push(std::move(obstacle_dets));
            }
        }
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << group("main")
                               << "Inference thread terminated with error: " << e.what()
                               << std::endl;
    }
}

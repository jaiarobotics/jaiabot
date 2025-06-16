#include <Wt/WContainerWidget.h>
#include <Wt/WGroupBox.h>
#include <Wt/WText.h>
#include <Wt/WPushButton.h>
#include <Wt/WTimer.h>
#include <Wt/WComboBox.h>
#include <Wt/WContainerWidget.h>
#include <Wt/WGroupBox.h>
#include <Wt/WLabel.h>
#include <Wt/WPanel.h>
#include <Wt/WSlider.h>
#include <Wt/WStackedWidget.h>
#include <chrono>

#include "liaison_production.h"

using namespace Wt;

namespace production
{

LiaisonProduction::LiaisonProduction(const Wt::WEnvironment& env)
    : Wt::WApplication(env)
{
    setTitle("Production App");
    useStyleSheet("style.css"); // Optional: remove if you don't use a custom CSS

    setup_ui();

    // Start a timer for periodic updates (simulated loop)
    update_timer_.setInterval(std::chrono::seconds(1));
    update_timer_.timeout().connect(this, &LiaisonProduction::run_tests_loop);
    update_timer_.start();
}

void LiaisonProduction::setup_ui()
{
    auto main_container = root()->addNew<WContainerWidget>();

    // Diagnostics Panel
    diagnostics_box_ = main_container->addNew<WGroupBox>("Component Diagnostics");
    diagnostics_status_ = diagnostics_box_->addNew<WText>("Status: Waiting to start...");
    diagnostics_box_->addNew<WPushButton>("Run Diagnostics")->clicked().connect([=] {
        diagnostics_status_->setText("Status: Running diagnostics...");
    });

    // Motor Test Panel
    motor_test_box_ = main_container->addNew<WGroupBox>("Motor Test");
    motor_status_ = motor_test_box_->addNew<WText>("Motor: Idle");
    motor_test_box_->addNew<WPushButton>("Spin Motor")->clicked().connect([=] {
        motor_status_->setText("Motor: Spinning...");
    });

    // Sea Trial Panel
    sea_trial_box_ = main_container->addNew<WGroupBox>("Sea Trial Controls");
    sea_trial_status_ = sea_trial_box_->addNew<WText>("Trial Status: Not started");
    sea_trial_box_->addNew<WPushButton>("Start Sea Trial")->clicked().connect([=] {
        sea_trial_status_->setText("Trial Status: In progress...");
    });

    // Digital Hygiene Panel
    hygiene_box_ = main_container->addNew<WGroupBox>("Digital Hygiene");
    hygiene_status_ = hygiene_box_->addNew<WText>("Hygiene: OK");
    hygiene_box_->addNew<WPushButton>("Clear Temp Files")->clicked().connect([=] {
        hygiene_status_->setText("Hygiene: Cleanup triggered");
    });
}

void LiaisonProduction::run_tests_loop()
{
    // Simulated auto-refresh or background update
    diagnostics_status_->setText("Status: Idle (auto-refresh)");
    motor_status_->setText("Motor: Idle");
    sea_trial_status_->setText("Trial Status: Standing by");
    hygiene_status_->setText("Hygiene: OK");
}

} // namespace production

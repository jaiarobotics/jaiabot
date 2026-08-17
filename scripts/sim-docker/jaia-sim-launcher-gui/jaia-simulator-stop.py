#!/usr/bin/env python3

import os
import platform
import subprocess
import sys
from pathlib import Path
import tkinter as tk
from tkinter import messagebox
import webbrowser
import time

from simulator_progress import SimulatorStartupProgress

ENV = os.environ.copy()
if sys.platform == "darwin":
    ENV["PATH"] = ENV.get("PATH", "") + ":/usr/local/bin"

creation_flags = 0
if sys.platform == "win32":
    creation_flags = subprocess.CREATE_NO_WINDOW

# Configuration
DOCKER_COMPOSE_FILE = Path.home() / "docker-compose.yml"

# Helpers
def check_docker_installed():
    try:
        subprocess.run(["docker", "--version"], creationflags=creation_flags, env=ENV, check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["docker", "compose", "version"], creationflags=creation_flags, env=ENV, check=True, stdout=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def stop_simulator():
    os.chdir(Path.home())
    subprocess.run(["docker", "compose", "down"], creationflags=creation_flags, env=ENV, check=True)

def require_docker_installed_or_exit():
    if not check_docker_installed():
        raise RuntimeError("🚨 Docker is not installed.")

def require_download_docker_compose():
    if not DOCKER_COMPOSE_FILE.exists():
        raise RuntimeError("🚨 Docker compose yml not found.")

# Main
def main():
    progress = SimulatorStartupProgress("Stopping Jaia Simulator", total_steps=3)

    try:
        progress.run_step("Checking Docker installation...", lambda: require_docker_installed_or_exit())
        time.sleep(1)
    except RuntimeError as e:
        webbrowser.open_new_tab("https://docs.docker.com/desktop/")
        progress.finish_with_message(
            "Docker Desktop needs to be installed before running/stopping the Jaia Simulator.\n\n"
            "Instructions:\n"
            "1. Go to: https://docs.docker.com/desktop/\n\n"
            "2. Download and install Docker Desktop    \n\n"
            "3. At the bottom of the page there should    \n"
            "be section titled 'Install Docker Desktop'\n"
            "with links for different operating systems\n\n"
            "4. Click the link for the instructions for your  \n"
            "machine.\n\n"
            "5. Follow instructions on page.                       "
        )
        sys.exit(1)

    try:
        progress.run_step("Verifying docker-compose.yml exists...", lambda: require_download_docker_compose())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "Missing docker-compose.yml\n\n"
            "Cannot find docker-compose.yml in your Home folder.\n\nNothing to stop."
        )
        sys.exit(1)

    progress.run_step("Stopping Jaia Simulator...", lambda: stop_simulator())
    time.sleep(1)

    progress.finish_with_message(
        "Jaia Simulator Stopped\n" 
        "✅ The Jaia Simulator has been stopped successfully."
    )

if __name__ == "__main__":
    main()

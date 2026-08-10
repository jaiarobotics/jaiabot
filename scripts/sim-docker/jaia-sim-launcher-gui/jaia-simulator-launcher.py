# jaia-simulator-launcher.py

import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

from simulator_progress import SimulatorStartupProgress

ENV = os.environ.copy()
if sys.platform == "darwin":
    ENV["PATH"] = ENV.get("PATH", "") + ":/usr/local/bin"

creation_flags = 0
if sys.platform == "win32":
    creation_flags = subprocess.CREATE_NO_WINDOW

# Configuration
DOCKER_COMPOSE_URL = "https://raw.githubusercontent.com/jaiarobotics/jaiabot/2.y/scripts/sim-docker/docker-compose.yml"
DOCKER_COMPOSE_FILE = Path.home() / "docker-compose.yml"
JDV_DATA_FOLDER = Path.home() / "jdv_data"
JCC_URL = "http://localhost:40001/"
JDV_URL = "http://localhost:40011/"

def check_docker_installed():
    try:
        subprocess.run(["docker", "--version"], creationflags=creation_flags, env=ENV, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["docker", "compose", "version"], creationflags=creation_flags, env=ENV, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def launch_docker_desktop():
    if sys.platform == "darwin":
        try:
            subprocess.Popen(["open", "-a", "Docker"], env=ENV)
            return True
        except Exception:
            return False
    elif sys.platform == "win32":
        docker_path = shutil.which("Docker Desktop")
        if not docker_path:
            possible_path = r"C:\Program Files\Docker\Docker\Docker Desktop.exe"
            if os.path.exists(possible_path):
                docker_path = possible_path
            else:
                return False
        subprocess.Popen([docker_path], creationflags=creation_flags, env=ENV, shell=True)
        return True
    else:
        # Add Linux support if needed
        return False


def is_docker_ready():
    try:
        subprocess.run(["docker", "info"], creationflags=creation_flags, env=ENV, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        return True
    except subprocess.CalledProcessError:
        return False


def download_docker_compose():
    if not DOCKER_COMPOSE_FILE.exists():
        try:
            if platform.system() == "Windows":
                subprocess.run(["curl", "-o", str(DOCKER_COMPOSE_FILE), DOCKER_COMPOSE_URL], creationflags=creation_flags, env=ENV, check=True, shell=True)
            else:
                subprocess.run(["curl", "-o", str(DOCKER_COMPOSE_FILE), DOCKER_COMPOSE_URL], creationflags=creation_flags, env=ENV, check=True)
        except Exception:
            return False
    return True


def create_jdv_data_folder():
    if not JDV_DATA_FOLDER.exists():
        JDV_DATA_FOLDER.mkdir()
    return True


def run_simulator():
    os.chdir(Path.home())
    try:
        subprocess.run(["docker", "compose", "up", "-d", "jaia-sim"], creationflags=creation_flags, env=ENV, check=True)
        return True
    except subprocess.CalledProcessError:
        return False


def wait_for_service(url, timeout=20):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    return True
        except:
            pass
        time.sleep(2)
    return False

def require_docker_installed_or_exit():
    if not check_docker_installed():
        raise RuntimeError("🚨 Docker is not installed.")

def require_docker_running_or_exit():
    if not launch_docker_desktop():
        raise RuntimeError("🚨 Could not launch docker desktop.")

def require_docker_ready():
    if not is_docker_ready():
        raise RuntimeError("🚨 Docker not ready")

def require_download_docker_compose():
    if not download_docker_compose():
        raise RuntimeError("🚨 Docker compose yml not found.")

def require_jdv_folder():
    if not create_jdv_data_folder():
        raise RuntimeError("🚨 JDV folder could not be created.")

def require_start_jaia_simulator():
    if not run_simulator():
        raise RuntimeError("🚨 Jaia simulator could not be started.")

def require_wait_for_jcc():
    if not wait_for_service(JCC_URL):
        raise RuntimeError("🚨 JCC did not start.")

def require_wait_for_jdv():
    if not wait_for_service(JDV_URL):
        raise RuntimeError("🚨 JDV did not start.")

def main():
    progress = SimulatorStartupProgress("Starting Jaia Simulator", total_steps=8)

    

    try:
        progress.run_step("Checking Docker installation...", lambda: require_docker_installed_or_exit())
        time.sleep(1)
    except RuntimeError as e:
        webbrowser.open_new_tab("https://docs.docker.com/desktop/")
        progress.finish_with_message(
            "Docker Desktop needs to be installed before running the Jaia Simulator.\n\n"
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
        progress.run_step("Launching Docker Desktop (if needed Test)...", lambda: require_docker_running_or_exit())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "Docker Not Found.\n\n"
            "Docker Desktop could not be found or started.\n"
        )
        sys.exit(1)

    if not progress.wait_step(
        "Waiting for Docker to be ready...\n\nIf you have not already, please go through the initial Docker setup.\n\nIf the docker desktop window opens and closes restart your computer and try again.",
        is_docker_ready,
        timeout=300,
        poll_interval=2,
    ):
        progress.finish_with_message(
            "Docker Timeout.\n\nDocker did not become ready in time.\n"
        )
        sys.exit(1)

    try:
        time.sleep(1)
        progress.run_step("Downloading docker-compose.yml...", lambda: require_download_docker_compose())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "Download Failed.\n\n"
            "Could not download docker-compose.yml.\n"
        )
        sys.exit(1)

    try:
        progress.run_step("Creating JDV data folder...", lambda: require_jdv_folder())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "Folder Creation Failed.\n\n"
            "Could not create jdv_data folder.\n"
        )
        sys.exit(1)

    try:
        progress.run_step("Starting Jaia Simulator...\n\nPlease wait, if this is the first time it could take ~2 minutes", lambda: require_start_jaia_simulator())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "Simulator Launch Failed.\n\n"
            "Could not start Jaia Simulator.\n"
        )
        sys.exit(1)

    try:
        progress.run_step("Waiting for JCC (port 40001)...", lambda: require_wait_for_jcc())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "JCC Launch Failed.\n\n"
        )
        sys.exit(1)

    try:
        progress.run_step("Waiting for JDV (port 40011)...", lambda: require_wait_for_jdv())
        time.sleep(1)
    except RuntimeError as e:
        progress.finish_with_message(
            "JDV Launch Failed.\n\n"
        )
        sys.exit(1)

    progress.run_step("Opening simulator in browser...\n\nJCC: localhost:40001\nJDV: localhost:40011", lambda: (webbrowser.open_new_tab(JCC_URL), webbrowser.open_new_tab(JDV_URL)))
    time.sleep(2)

    progress.finish_with_message(
        "Simulator Ready\n"
        "The Jaia Simulator is now running!\n\n"
        "JCC is running at address: localhost:40001\n"
        "JDV is running at address: localhost:40011",
        "OK",
        True
    )

if __name__ == "__main__":
    main()
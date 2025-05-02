# simulator_progress.py

import threading
import tkinter as tk
from tkinter import ttk
import webbrowser

class SimulatorStartupProgress:
    def __init__(self, title, total_steps):
        self.total_steps = total_steps
        self.current_step = 0
        self._error = None

        self.root = tk.Tk()
        self.root.title(title)
        self.root.geometry("600x350")
        self.root.resizable(False, False)

        self.label = tk.Label(self.root, text="Initializing...", font=("Arial", 12))
        self.label.pack(pady=10)

        self.progress = ttk.Progressbar(self.root, orient="horizontal", length=350, mode="determinate")
        self.progress.pack(pady=10)
        self.progress["maximum"] = total_steps

        self.root.update()

    def update(self, message):
        self.current_step += 1
        self.label.config(text=message)
        self.progress["value"] = self.current_step
        self.root.update()

    def run_step(self, message, step_fn):
        """Runs a step in a thread and re-raises any exception in main thread using after loop."""
        self.update(message)
        done = threading.Event()

        def worker():
            try:
                step_fn()
            except Exception as e:
                self._error = e
            finally:
                done.set()

        threading.Thread(target=worker, daemon=True).start()

        while not done.is_set():
            self.root.update()

        if self._error:
            raise self._error

    def wait_step(self, message, condition_fn, timeout=60, poll_interval=2):
        """Polls a condition function in the background, shows progress, returns success/failure."""
        self.update(message)
        result = threading.Event()
        failed = threading.Event()

        def checker():
            import time
            start = time.time()
            while time.time() - start < timeout:
                try:
                    if condition_fn():
                        result.set()
                        return
                except Exception:
                    pass
                time.sleep(poll_interval)
            failed.set()

        threading.Thread(target=checker, daemon=True).start()

        while not result.is_set() and not failed.is_set():
            self.root.update()

        return result.is_set()

    def finish_with_message(self, final_message, button_text="OK", add_jcc_jdv_links=False):
        """Show a final message and wait for user to click OK, then close."""
        for widget in self.root.winfo_children():
            widget.destroy()

        self.label = tk.Label(self.root, text=final_message, font=("Arial", 12))
        self.label.pack(pady=20)

        if add_jcc_jdv_links:
            # Clickable JCC link
            jcc_link = tk.Label(self.root, text="Open JCC (localhost:40001)", fg="blue", cursor="hand2", font=("Arial", 10, "underline"))
            jcc_link.pack()
            jcc_link.bind("<Button-1>", lambda e: webbrowser.open("http://localhost:40001"))

            # Clickable JDV link
            jdv_link = tk.Label(self.root, text="Open JDV (localhost:40011)", fg="blue", cursor="hand2", font=("Arial", 10, "underline"))
            jdv_link.pack()
            jdv_link.bind("<Button-1>", lambda e: webbrowser.open("http://localhost:40011"))

        button = tk.Button(self.root, text=button_text, command=self.close)
        button.pack(pady=10)

        # 🪄 Bring window to front
        self.root.attributes("-topmost", True)
        self.root.lift()
        self.root.after(100, lambda: self.root.attributes("-topmost", False))

        self.root.mainloop()

    def close(self):
        self.root.quit()
        self.root.destroy()

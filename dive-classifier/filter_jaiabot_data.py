import h5py
import os
import sys
from glob import glob

def filter_jaiabot_data(input_path, output_dir):
    """Filter one file to keep only jaiabot::imu and jaiabot::pressure_adjusted"""
    with h5py.File(input_path, "r") as src:
        base_name = os.path.basename(input_path)
        base, ext = os.path.splitext(base_name)
        output_path = os.path.join(output_dir, base + "_filtered" + ext)

        with h5py.File(output_path, "w") as dst:
            found_any = False
            for key in src.keys():
                if key in ["jaiabot::imu", "jaiabot::pressure_adjusted", "jaiabot::bot_status;14"]:
                    print(f"  → Copying dataset: {key}")
                    src.copy(key, dst)
                    found_any = True

            if not found_any:
                print(f"  ⚠️  No target datasets found in {base_name}")

        print(f"✅ Created: {output_path}\n")


def process_directory(input_dir):
    """Process all .h5 files in a directory"""
    input_dir = os.path.abspath(input_dir)
    output_dir = os.path.join(os.path.dirname(input_dir), "dives-filtered")
    os.makedirs(output_dir, exist_ok=True)

    files = sorted(glob(os.path.join(input_dir, "*.h5")))
    if not files:
        print("❌ No .h5 files found in the specified directory.")
        return

    print(f"Processing {len(files)} HDF5 files from {input_dir}")
    print(f"Filtered outputs will be saved to: {output_dir}\n")

    for file_path in files:
        print(f"Processing: {os.path.basename(file_path)}")
        filter_jaiabot_data(file_path, output_dir)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python filter_jaiabot_dir.py <directory_with_h5_files>")
        sys.exit(1)

    input_directory = sys.argv[1]
    process_directory(input_directory)

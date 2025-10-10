import h5py

# --- Use one of the files that is failing ---
filename = '/home/dedelekan/jaiabot/dive-classifier/dives/bot1_fleet50_20250905T140259.h5'

print(f"Inspecting START/STOP marker structures in: {filename}\n")

def inspect_marker_dataset(hf, path):
    print(f"--- Checking Dataset: '{path}' ---")
    try:
        dataset = hf[path]
        print(f"✅ Found Dataset.")
        # The Dtype will tell us the real column names (e.g., 'time', 'f0', etc.)
        print(f"   ├── Dtype: {dataset.dtype}")
        print(f"   └── Shape: {dataset.shape}")
        if dataset.shape[0] > 0:
            print(f"   └── First row: {dataset[0]}")
    except KeyError:
        print("❌ Not found.")
    except Exception as e:
        print(f"An error occurred: {e}")
    print("-" * 40)

try:
    with h5py.File(filename, 'r') as hf:
        inspect_marker_dataset(hf, 'START_BOTTOM_TYPE_SAMPLING')
        inspect_marker_dataset(hf, 'STOP_BOTTOM_TYPE_SAMPLING')
except Exception as e:
    print(f"Failed to open file. Error: {e}")
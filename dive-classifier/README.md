# Bottom Dive Type Classification Pipeline

This repository contains scripts to process Jaiabot dive HDF5 data, extract impact-related features, and train a classifier to predict bottom dive types (Soft vs Hard) using machine learning.

---

## Files

### 1. `filter_jaiabot_data.py`

**Purpose:**  
Filters raw Jaiabot HDF5 files to retain only the necessary datasets for analysis, reducing file size and focusing only on relevant data.

**Key Points:**

- **Input:** Directory containing raw `.h5` files.  
- **Output:** Filtered `.h5` files saved in a `dives-filtered` directory next to the input folder.  
- **Retains only the following datasets from each file:**
  - `jaiabot::imu` → IMU sensor data (acceleration)  
  - `jaiabot::pressure_adjusted` → Pressure/depth data  
  - `jaiabot::bot_status;14` → Bot status info  
  - `jaiabot::mission_dive` → Dive mission debug info  
  - `jaiabot::task_packet;14` → Task packets including bottom dive flags  

**Usage:**

```bash
python3 filter_jaiabot_dir.py <directory_with_h5_files>
```

### 2. train_bottom_type_classifier.py

**Purpose**:  
Extracts impact features from filtered dive data, selects the best feature set using unsupervised clustering (KMeans), and trains a classifier to predict bottom dive types in future dives.

**Workflow**:  

#### Feature Extraction:  
- Reads each filtered .h5 file.  
- Processes bottom dives only.  
- Extracts these features for each dive:  
  - peak_acceleration → Max absolute acceleration within impact window  
  - impact_duration → Duration above 75% of peak acceleration  
  - max_jerk → Maximum rate of change of acceleration  
- Keeps ascent_type (powered or unpowered) for evaluation only.  

#### Best Feature Set Selection:  
- Considers all combinations of 1 to 3 features (impact_duration, peak_acceleration, max_jerk).  
- For each combination:  
  - Performs KMeans clustering with 2 clusters.  
  - Maps cluster labels to ascent_type to compute weighted F1 score.  
  - Selects the combination with highest F1, breaking ties in favor of smaller feature sets.  

#### Classifier Training:  
- Uses the KMeans cluster labels as ground truth (Soft / Hard).  
- Trains multiple classifiers:  
  - Random Forest  
  - Gradient Boosting  
  - Logistic Regression  
  - SVM (with probability outputs)  
- Evaluates each via 5-fold cross-validation on the cluster labels.  
- Selects the classifier with highest F1 and trains it on all data.  

**Output**:  
- Saves a pipeline containing the trained classifier and feature set as bottom_type_model.pkl.  

**Usage**:  
```bash
python3 train_bottom_type_classifier.py
```

### 3. setup_env.sh

**Purpose**:  
Sets up the necessary environment to run the python files

## Notes

- The classifier does not directly predict powered vs unpowered. Ascent type is only used to select the best feature set.  
- Prediction labels (Soft / Hard) are derived from KMeans clusters representing bottom dive types.  
- The trained model includes StandardScaler for feature normalization.
- Both the filtered and unfiltered hdf5 files are on sharepoint in Documents/Checkouts/CheckoutLogs/Bottom type dataset/
- If you are directly using the filtered files, you dont need to run the filter_jaiabot_data.py, just store the filtered files in a folder called dives-filtered in the dive-classifier folder.

## Example Workflow

Setup environment
```bash
 ./setup_env.sh
 source bottom_env/bin/activate
 ```
Filter raw dive data:  
```bash
python3 filter_jaiabot_data.py ./raw_jaiabot_data
```
Train the bottom type classifier:
```bash
python3 train_bottom_type_classifier.py
```
Use the saved model (bottom_type_model.pkl) for real-time predictions on new dives (requires extracting the same features).


## Future Steps

- Implement real-time inference script to predict bottom dive type during live dives using the saved model.  
- Extend feature set to include other sensor modalities if needed.  
- Tune classifier hyperparameters for higher accuracy.
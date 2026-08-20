# PyJaia Tests

This directory contains tests for the pyjaia Python package.

## Running the Tests

### Prerequisites

**Note:** On modern Linux systems with externally-managed Python environments (PEP 668), you'll need to use a virtual environment.

#### Option 1: Using a Virtual Environment (Recommended)

Create and activate a virtual environment:

```bash
cd src/python/pyjaia
python3 -m venv venv
source venv/bin/activate  # On Linux/Mac
# OR
venv\Scripts\activate  # On Windows
```

Then install the dependencies:

```bash
pip install -e .
pip install pytest
```

#### Option 2: Using System Python (if allowed)

If your system allows it:

```bash
cd src/python/pyjaia
pip install -e .
pip install pytest
```

If you get an "externally-managed-environment" error, use Option 1 instead.

### Running All Tests

To run all tests in this directory:

```bash
cd src/python/pyjaia
pytest tests/
```

### Running Specific Test Files

To run a specific test file:

```bash
cd src/python/pyjaia
pytest tests/test_utils.py
pytest tests/test_logtools.py
pytest tests/test_contours.py
```

### Running Specific Test Functions

To run a specific test function:

```bash
cd src/python/pyjaia
pytest tests/test_utils.py::test_myip_success
pytest tests/test_utils.py::test_myip_handles_socket_error
pytest tests/test_utils.py::test_myip_handles_gaierror
```

### Verbose Output

For more detailed output, add the `-v` flag:

```bash
pytest tests/ -v
```

### Test Coverage

To run tests with coverage:

```bash
pip install pytest-cov
pytest tests/ --cov=pyjaia --cov-report=html
```

## Test Files

- `test_utils.py` - Tests for utility functions including `myip()`
- `test_logtools.py` - Tests for log reading and processing
- `test_contours.py` - Tests for contour generation
- `test_task_packet_database.py` - Tests for task packet database operations
- `test_battery_prediction_endpoint.py` - Tests for the /jaia/v0/battery-prediction Flask endpoint

## Deactivating Virtual Environment

When you're done testing, deactivate the virtual environment:

```bash
deactivate
```

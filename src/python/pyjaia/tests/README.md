# PyJaia Tests

This directory contains tests for the pyjaia Python package.

## Running the Tests

### Prerequisites

Install the required dependencies:

```bash
cd src/python/pyjaia
pip install -e .
pip install pytest
```

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

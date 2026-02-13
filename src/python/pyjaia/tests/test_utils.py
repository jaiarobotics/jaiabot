#!/usr/bin/env python3

import socket
from unittest import mock
from pyjaia.utils import myip


def test_myip_success():
    """Test that myip returns a valid IP address or localhost."""
    result = myip()
    assert isinstance(result, str)
    assert len(result) > 0
    # Should return either a valid IP or "localhost"
    if result != "localhost":
        # Validate it's a proper IPv4 address
        parts = result.split('.')
        assert len(parts) == 4, f"IPv4 should have 4 octets, got {len(parts)}"
        assert all(part.isdigit() and 0 <= int(part) <= 255 for part in parts), \
            f"All octets should be 0-255, got {result}"


def test_myip_handles_socket_error():
    """Test that myip returns localhost when socket operations fail."""
    with mock.patch('socket.gethostbyname_ex', side_effect=socket.error("Network error")):
        with mock.patch('socket.socket', side_effect=socket.error("Network error")):
            result = myip()
            assert result == "localhost"


def test_myip_handles_exception():
    """Test that myip returns localhost when any exception occurs."""
    with mock.patch('socket.gethostbyname_ex', side_effect=Exception("Generic error")):
        result = myip()
        assert result == "localhost"

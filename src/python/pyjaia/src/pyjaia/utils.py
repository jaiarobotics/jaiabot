import socket
import re
import os


def myip():
    """Gets the local machine's IP address.

    Returns:
        str: The local machine's IP address, or "localhost" if not found.
    """
    return (([ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")] or [[(s.connect(("8.8.8.8", 53)), s.getsockname()[0], s.close()) for s in [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) + ["localhost"])[0]


def sanitize_filename(filename: str):
    """Removes or replaces invalid characters from a filename.
    
    Args:
        filename: The filename to sanitize.
    
    Returns:
        A sanitized filename.
    """
    
    invalid_chars = r'<>:"/\\|?*'
    
    # Replace invalid characters with an empty string
    filename = re.sub(f'[{re.escape(invalid_chars)}]', '', filename)
    
    # Remove leading and trailing spaces
    filename = filename.strip()
    
    # Shorten filename if it exceeds the maximum length
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext) -1] + ext

    return filename

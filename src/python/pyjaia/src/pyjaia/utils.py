import socket


def myip():
    """Gets the local machine's IP address.

    Returns:
        str: The local machine's IP address, or "localhost" if not found.
    """
    return (([ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127.")] or [[(s.connect(("8.8.8.8", 53)), s.getsockname()[0], s.close()) for s in [socket.socket(socket.AF_INET, socket.SOCK_DGRAM)]][0][1]]) + ["localhost"])[0]

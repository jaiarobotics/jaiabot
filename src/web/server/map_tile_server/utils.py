import os.path


def get_directory_size(path):
    """
    Calculates the total size of a directory recursively, including all files
    and subdirectories.

    Args:
        path (str): The path to the directory.

    Returns:
        int: The total size of the directory in bytes.
    """
    total_size = 0
    file_count = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            # Handle potential permission errors or broken symlinks
            try:
                total_size += os.path.getsize(fp)
                file_count += 1
            except (FileNotFoundError, PermissionError):
                pass  # Skip inaccessible files
    return total_size, file_count

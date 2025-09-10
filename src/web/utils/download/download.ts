/**
 * Triggers a browser download of data as a file.
 *
 * @param fileName Name of the downloaded file
 * @param data Contents of the file (string or BlobPart)
 * @param mimeType Optional MIME type (default "application/octet-stream")
 */
export function downloadFile(
    fileName: string,
    data: string | BlobPart,
    mimeType = "application/octet-stream",
) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;

    // Append to DOM, trigger click, then clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL to avoid memory leaks
    URL.revokeObjectURL(link.href);
}

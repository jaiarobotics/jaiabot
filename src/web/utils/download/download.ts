/**
 * Triggers a browser download of data as a file
 *
 * @param {string} fileName Name of the downloaded file
 * @param {string | BlobPart} data Contents of the file
 * @param {string} mimeType Optional MIME type (default "application/octet-stream")
 * @returns {void}
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
    link.addEventListener("click", (event) => event.stopPropagation());

    // Append to DOM, trigger click, then clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL to avoid memory leaks
    URL.revokeObjectURL(link.href);
}

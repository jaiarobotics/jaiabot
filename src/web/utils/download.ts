/**
 * Starts a browser download of a file with string contents
 *
 * @param {string} data Contents written to file
 * @param {string} mimeType Informs the browser of the type of data being sent
 * @param {string} fileName Name given to the downloadable file
 * @returns {void}
 */
export function downloadToFile(data: string, mimeType: string, fileName: string) {
    const blob = new Blob([data], { type: mimeType });

    var link = window.document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    // Construct filename dynamically and set to link.download
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Starts a browser download of a file with binary data contents
 *
 * @param {string} name Name given to the downloadable file
 * @param {BlobPart} data Contents written to file
 * @returns {void}
 */
export function downloadBlobToFile(name: string, data: BlobPart) {
    let a = document.createElement("a");
    if (a.download !== undefined) {
        a.download = name;
    }
    a.href = URL.createObjectURL(
        new Blob([data], {
            type: "application/octet-stream",
        }),
    );
    a.dispatchEvent(new MouseEvent("click"));
}

import { jaiaAPI } from "../jaia-api";
import { warning } from "../notifications";

const HTTP_NO_CONTENT = 204;

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

    // Append to DOM, trigger click, then clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL to avoid memory leaks
    URL.revokeObjectURL(link.href);
}

/**
 * Gets the CTD files from the Hub and downloads them to the client computer
 *
 * @param {boolean} deleteCTDFiles Clear the files from the Hub after download
 * @returns {void}
 */
export async function getCTDFiles() {
    const res = await jaiaAPI.getCTDProfiles();

    if (res.status === HTTP_NO_CONTENT) {
        warning("No new CTD profiles on the Hub");
        return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jaia-ctd.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

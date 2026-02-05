/**
 * Opens a file dialog for a user to select files
 *
 * @param {string} accept Which file types to accept (".kmz")
 * @param {boolean} multiple Allows the user to select multiple files
 * @returns {void}
 */
export function openFileDialog(accept: string, multiple: boolean) {
    return new Promise<FileList>((resolve, reject) => {
        let input = document.createElement("input") as HTMLInputElement;
        input.type = "file";

        input.setAttribute("accept", accept);

        if (multiple) {
            input.setAttribute("multiple", "");
        }

        input.onchange = function (event: InputEvent) {
            resolve(input.files);
        };
        input.click();
    });
}

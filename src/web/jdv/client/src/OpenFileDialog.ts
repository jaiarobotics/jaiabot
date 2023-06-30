/**
 * Creates a File Open dialog box, and returns a promise containing the files selected
 * 
 * @param accept Acceptable file types, e.g. ".kmz" or "image/png"
 * @param multiple Allow multiple file selection?
 * @returns 
 */
export default function OpenFileDialog(accept: string, multiple: boolean) {
    return new Promise<FileList>((resolve, reject) => {
        let input = document.createElement("input") as HTMLInputElement
        input.type = "file"

        input.setAttribute('accept', accept)

        if (multiple) {
            input.setAttribute('multiple', '')
        }
        
        input.onchange = function (event: InputEvent) {
            resolve(input.files)
        }
        input.click()
    })
}

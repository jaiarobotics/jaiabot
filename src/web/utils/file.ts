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

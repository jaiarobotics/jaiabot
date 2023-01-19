// Gets the template with id, and inserts innerHTML into all of its children using mappings, 
// with the keys being id's, and the values being the innerHTML to insert
export function get(id: string, mappings: {[key: string]: string}) {
    const template = document.querySelector('template')
    var div = template.content.querySelector('#' + id).cloneNode(true) as HTMLDivElement

    for (const key of Object.keys(mappings)) {
        const value = mappings[key]
        const element = div.querySelector('#' + key)

        if (element != null) {
            element.innerHTML += value
        }
    }

    return div
}

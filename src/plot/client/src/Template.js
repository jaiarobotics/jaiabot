export function get(id, mappings) {
    const template = document.querySelector('template')
    var div = template.content.querySelector('#' + id).cloneNode(true)

    for (const key of Object.keys(mappings)) {
        const value = mappings[key]
        const element = div.querySelector('#' + key)

        if (element != null) {
            element.innerHTML += value
        }
    }

    return div
}

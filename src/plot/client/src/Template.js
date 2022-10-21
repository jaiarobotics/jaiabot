export function get(id, mappings) {
    const template = document.querySelector('template')
    console.log(template)
    var div = template.content.querySelector('#' + id).cloneNode(true)
    console.log(id)
    console.log(div)

    for (const key of Object.keys(mappings)) {
        const value = mappings[key]
        const element = div.querySelector('#' + key)

        if (element != null) {
            element.innerHTML += value
        }
    }

    console.log(div)

    return div
}

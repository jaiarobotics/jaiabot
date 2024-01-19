// Gets an element with this id
function byId(id) {
    const element = document.getElementById(id)
    if (!element) {
      console.warn("WARNING: Cannot locate element with id = ", id)
    }
    return element
}

export { byId }

// Saving and loading settings from browser's localStorage

export class Settings {

    static read(key) {
        let valueString = localStorage.getItem(key)
        if (!valueString) {
        return null
        }
        else {
        return JSON.parse(valueString)
        }
    }
  
    static write(key, value) {
        localStorage.setItem(key, JSON.stringify(value))
    }

}

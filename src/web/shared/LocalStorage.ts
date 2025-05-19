export function readLocalStorage<T>(name: string, defaultValue: T): T {
    const stringValue = localStorage.getItem(name);
    if (stringValue == null) {
        return defaultValue;
    }

    try {
        return JSON.parse(stringValue);
    } catch (error) {
        console.warn(error);
        return defaultValue;
    }
}

export function writeLocalStorage<T>(name: string, new_value: T) {
    try {
        localStorage.setItem(name, JSON.stringify(new_value));
    } catch (error) {
        console.warn(error);
    }
}

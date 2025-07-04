export const saveIsThemeCompatible = (isThemeCompatible) => {
    addToStorage(StorageKeys.isThemeCompatible, isThemeCompatible)
}
export const fetchIsThemeCompatible = () => {
    const isThemeCompatible = fetchFromStorage(StorageKeys.isThemeCompatible);
    return isThemeCompatible === null ? isThemeCompatible : isThemeCompatible === 'true'
}

export const saveIsThemeBlockAdded = (isThemeBlockAdded) => {
    addToStorage(StorageKeys.isThemeBlockAdded, isThemeBlockAdded)
}

export const fetchIsThemeBlockAdded = () => {
    const isThemeBlockAdded = fetchFromStorage(StorageKeys.isThemeBlockAdded);

    return isThemeBlockAdded === null ? isThemeBlockAdded : isThemeBlockAdded === 'true'
}

const addToStorage = (key, value) => {
    if(value === undefined || value === null) return localStorage?.removeItem(key)

    try {
        console.log("dd {key} to storage");
        localStorage?.setItem(key, value)
    } catch (e) {
        console.log("AddToStorage: Local Storage not available")
    }
}

const fetchFromStorage = (key, defaultValue = null) => {
    let item = defaultValue;
    try {
        item = localStorage?.getItem(key) || defaultValue
    } catch (e) {
        console.log("FetchFromStorage: Local Storage not available")
    }
    return item

}

const StorageKeys = {
    isThemeBlockAdded: 'popShopIsThemeBlockAdded'
}
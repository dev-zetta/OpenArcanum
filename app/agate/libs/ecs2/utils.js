/**
 * A faster version of bind.
 *
 * @param {*} thisArg - The context to call the function with.
 * @param {function} methodFunc - The function to bind.
 * @return {function} A bound version of the function.
 */
export function fastBind(thisArg, methodFunc) {
    return function _boundFunction() {
        methodFunc.apply(thisArg, arguments); // eslint-disable-line prefer-rest-params
    };
}

/**
 * A faster version of splice.
 *
 * @param {*[]} array - The array to remove from
 * @param {number} startIndex - Index to start removal
 * @param {number} removeCount - The number of elements to remove.
 */
export function fastSplice(array, startIndex, removeCount) {
    const len = array.length;

    if (startIndex >= len || removeCount === 0) {
        return;
    }

    removeCount = startIndex + removeCount > len ? (len - startIndex) : removeCount;

    const removeLen = len - removeCount;

    for (let i = startIndex; i < len; i += 1) {
        array[i] = array[i + removeCount];
    }

    array.length = removeLen;
}

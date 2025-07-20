const jsonParseSafely = (jsonString) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return null;
    }
}

export default jsonParseSafely;
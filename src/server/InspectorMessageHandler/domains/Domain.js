class Domain {

    static BLOCK = true;
    static CONTINUE = false;

    constructor() {
        if (!this.constructor.name) {
            throw new Error('Domain name is required');
        }
    }

    handler = (connection, payload) => {
        throw new Error('Handler is not implemented');
    }
}

export default Domain;
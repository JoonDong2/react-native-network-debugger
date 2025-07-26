const makeDomains = (domainArray) => {
    const domains = domainArray.reduce((acc, domain) => {
        acc[domain.constructor.name] = domain;
        return acc;
    }, {});

    return {
        get: (method) => {
            if (typeof method !== 'string') {
                return undefined;
            }

            const domain = method.split('.')[0];
            return domains[domain];
        }
    }
}

export default makeDomains;
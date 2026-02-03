import type { IDomain, DomainsMap } from '../../types/domain';

interface DomainConstructor {
  domainName?: string;
  name: string;
}

const makeDomains = (domainArray: IDomain[]): DomainsMap => {
  const domains: Record<string, IDomain> = domainArray.reduce<Record<string, IDomain>>(
    (acc, domain) => {
      const constructor = domain.constructor as DomainConstructor;
      const domainName = constructor.domainName || constructor.name;
      acc[domainName] = domain;
      return acc;
    },
    {}
  );

  return {
    get: (method: string | undefined): IDomain | undefined => {
      if (typeof method !== 'string') {
        return undefined;
      }

      const domain = method.split('.')[0];
      return domains[domain];
    },
  };
};

export default makeDomains;

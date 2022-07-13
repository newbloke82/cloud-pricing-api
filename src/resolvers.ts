import { IResolvers } from '@graphql-tools/utils';
import mingo from 'mingo';
import { Price, Product } from './db/types';
import currency, { CURRENCY_CODES } from './utils/currency';
import { findProducts } from './db/query';

const productLimit = 1000;

type MongoDbFilter = { [attr: string]: { [op: string]: string | RegExp } };

type Filter = { [key: string]: string };

type AttributeFilter = {
  key: string;
  value?: string;
  // eslint-disable-next-line camelcase
  value_regex?: string;
};

interface ProductsArgs {
  filter: Filter & {
    attributeFilters: AttributeFilter[];
  };
}

interface PricesArgs {
  filter: Filter;
}

type TransformedProductAttribute = {
  key: string;
  value: string;
};

function strToRegex(str: string): RegExp {
  const pattern = (str.match(/\/(.+)\/.*/) || [''])[1];
  const options = (str.match(/\/.+\/(.*)/) || [undefined])[1];
  return new RegExp(pattern, options);
}

interface ResolverOptions {
  convertPrices?(prices: Price[]): Promise<void>;
}

const getResolvers = (ops: ResolverOptions): IResolvers => ({
  Query: {
    products: async (
      _parent: unknown,
      args: ProductsArgs
    ): Promise<Product[]> => {
      const { attributeFilters, ...otherFilters } = args.filter;
      return findProducts(otherFilters, attributeFilters, productLimit);
    },
  },
  Product: {
    attributes: async (
      product: Product
    ): Promise<TransformedProductAttribute[]> =>
      Object.entries(product.attributes).map((a) => ({
        key: a[0],
        value: a[1],
      })),
    prices: async (product: Product, args: PricesArgs): Promise<Price[]> => {
      const prices = mingo
        .find(product.prices, transformFilter(args.filter))
        .all() as Price[];
      await convertCurrencies(prices);
      if (ops.convertPrices) {
        await ops.convertPrices(prices);
      }

      return prices;
    },
  },
  Price:
    // For every alternate currency, add a resolver that converts from USD.
    Object.fromEntries(
      CURRENCY_CODES.map((code) => [
        code,
        async (price: Price): Promise<number> =>
          currency.convert('USD', code, Number(price.USD)),
      ])
    ),
});

function transformFilter(filter: Filter): MongoDbFilter {
  const transformed: MongoDbFilter = {};
  if (!filter) {
    return transformed;
  }
  Object.entries(filter).forEach((filterItem) => {
    const keyPart = filterItem[0];
    let value: any = filterItem[1]; // eslint-disable-line @typescript-eslint/no-explicit-any
    let op = '$eq';

    const [key, opPart] = keyPart.split('_');
    if (opPart === 'regex') {
      op = '$regex';
      value = strToRegex(value);
    } else if (value === '') {
      op = '$in';
      value = ['', null];
    }

    transformed[key] = {};
    transformed[key][op] = value;
  });
  return transformed;
}

async function convertCurrencies(prices: Price[]) {
  for (const price of prices) {
    // use == instead of === so we're checking for null || undefined.
    if (price.USD == null && price.CNY != null) {
      const usd = await currency.convert('CNY', 'USD', Number(price.CNY));
      price.USD = usd.toString();
    }
  }
}

export default getResolvers;

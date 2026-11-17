import type { BeanBaseBean } from './beanBase';

// Invented beans in the shape of the real API; never paste real API data here (terms forbid redistribution).
const bean = (o: Partial<BeanBaseBean> & Pick<BeanBaseBean, 'id' | 'roaster' | 'roast-name'>): BeanBaseBean => ({
  link: null, origin: null, region: null, producer: null, variety: null, process: null,
  harvest: null, tasting: null, degree: null, 'min-elev': null, 'max-elev': null, date: '2026-01-01', ...o
});

export const BEANS: BeanBaseBean[] = [
  bean({
    id: 101, roaster: 'Example Roasters', 'roast-name': 'Huila Washed', link: 'https://example.com/products/huila-washed',
    origin: 'Colombia', region: 'Acevedo, Huila', producer: 'Juan Pena', variety: 'Caturra', process: 'washed',
    harvest: '45992', tasting: 'Peach, Jasmine, Honey', degree: 'Light To Medium', 'min-elev': 1700, 'max-elev': 1900
  }),
  bean({
    id: 102, roaster: 'Example Roasters', 'roast-name': 'Kenya Kiambu', link: 'https://example.com/products/kenya-kiambu',
    origin: 'Kenya', harvest: 'Sat Jan 11 2025 00:00:00 GMT+0000 (Coordinated Universal Time)', tasting: 'Blackcurrant',
    'min-elev': 1800, 'max-elev': 1800
  }),
  bean({ id: 103, roaster: 'Fake Bean Co', 'roast-name': 'Twin', link: 'https://fake.example.org/products/twin-a', harvest: 'March 2025' }),
  bean({ id: 104, roaster: 'Fake Bean Co', 'roast-name': 'Twin', link: 'https://fake.example.org/products/twin-b', harvest: '???' }),
  bean({ id: 105, roaster: 'Other Sub Brand', 'roast-name': 'Collab Lot', link: 'https://example.com/products/collab-lot' })
];

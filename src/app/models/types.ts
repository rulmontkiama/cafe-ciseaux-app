export interface Prestation {
  id: number;
  name: string;
  durationMin: number;
  price: string;
}

export const DEFAULT_PRESTATIONS: Prestation[] = [
  { id: 1, name: 'COUPE', durationMin: 20, price: '18 €' },
  { id: 2, name: 'COUPE + SHAMPOING', durationMin: 20, price: '22 €' },
  { id: 3, name: 'COUPE + BARBE', durationMin: 20, price: '25 €' },
  { id: 4, name: 'BARBE', durationMin: 20, price: '13 €' },
  { id: 5, name: 'SHAMPOING', durationMin: 20, price: '4 €' },
  { id: 6, name: 'MÈCHES', durationMin: 20, price: '60 €' },
  { id: 7, name: 'COLORATION', durationMin: 20, price: '80 €' }
];

export const types = DEFAULT_PRESTATIONS;

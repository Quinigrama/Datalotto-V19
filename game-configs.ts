export interface GameConfig {
  id: string;
  name: string;
  maxNumbers: number;
  numberRange: number;
  maxStars: number;
  starRange: number;
  gridCols: number;
}

export const GAMES: { [key: string]: GameConfig } = {
  'bonoloto': {
    id: 'bonoloto',
    name: 'Bonoloto',
    maxNumbers: 6,
    numberRange: 49,
    maxStars: 0,
    starRange: 0,
    gridCols: 7
  },
  'primitiva': {
    id: 'primitiva',
    name: 'Primitiva',
    maxNumbers: 6,
    numberRange: 49,
    maxStars: 0,
    starRange: 0,
    gridCols: 7
  },
  'gordo': {
    id: 'gordo',
    name: 'El Gordo',
    maxNumbers: 5,
    numberRange: 54,
    maxStars: 1,
    starRange: 10,
    gridCols: 9
  },
  'euromillones': {
    id: 'euromillones',
    name: 'Euromillones',
    maxNumbers: 5,
    numberRange: 50,
    maxStars: 2,
    starRange: 12,
    gridCols: 10
  },
  'eurodreams': {
    id: 'eurodreams',
    name: 'EuroDreams',
    maxNumbers: 6,
    numberRange: 40,
    maxStars: 1,
    starRange: 5,
    gridCols: 10
  }
};

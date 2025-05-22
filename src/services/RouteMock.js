import mockRoutes from './mockRoutes.json';

export const getRoute = async (start, end) => {
  console.log('Mock getRoute:', { start, end });
  return mockRoutes;
};
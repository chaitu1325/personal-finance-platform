const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'];
const MODULES = [
  { key: 'dashboard', label: 'Dashboard', endpoint: '/dashboard' },
  { key: 'transactions', label: 'Income & expenses', endpoint: '/transactions' },
  { key: 'persons', label: 'Family members', endpoint: '/persons' },
  { key: 'properties', label: 'Rental properties', endpoint: '/properties' },
  { key: 'investments', label: 'Investments', endpoint: '/investments' },
  { key: 'assets', label: 'Assets', endpoint: '/assets' },
  { key: 'liabilities', label: 'Liabilities', endpoint: '/liabilities' },
  { key: 'budgets', label: 'Budgets', endpoint: '/budgets' },
  { key: 'goals', label: 'Goals', endpoint: '/goals' }
];

if (typeof module !== 'undefined') {
  module.exports = { MODULES: MODULES, TRANSACTION_TYPES: TRANSACTION_TYPES };
}

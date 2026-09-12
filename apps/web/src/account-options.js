export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank account' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'INVESTMENT', label: 'Investment account' },
  { value: 'OTHER', label: 'Other' }
];

export function getAccountTypeLabel(accountType) {
  var match = ACCOUNT_TYPE_OPTIONS.find(function (option) { return option.value === accountType; });
  return match ? match.label : (accountType || 'Account');
}

export function buildAccountOptions(accounts) {
  if (!Array.isArray(accounts)) return [];
  return accounts
    .filter(function (account) { return account && account.status === 'ACTIVE'; })
    .map(function (account) {
      var institution = account.institution ? ' — ' + account.institution : '';
      return {
        value: String(account.id),
        label: account.name + institution + ' (' + getAccountTypeLabel(account.account_type) + ')'
      };
    });
}

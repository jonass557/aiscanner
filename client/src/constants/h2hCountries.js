/**
 * iKeePay H2H supported countries, dial codes, default currencies, and operators.
 */
export const H2H_COUNTRIES = [
  { code: 'CI', name: "Côte d'Ivoire", dial: '225', currency: 'XOF', operators: ['ORANGE', 'MTN', 'WAVE', 'MOOV'] },
  { code: 'SN', name: 'Sénégal', dial: '221', currency: 'XOF', operators: ['ORANGE', 'WAVE', 'FREE', 'EMONEY'] },
  { code: 'BF', name: 'Burkina Faso', dial: '226', currency: 'XOF', operators: ['ORANGE', 'MOOV', 'MOBICASH'] },
  { code: 'BJ', name: 'Bénin', dial: '229', currency: 'XOF', operators: ['MTN', 'MOOV'] },
  { code: 'TG', name: 'Togo', dial: '228', currency: 'XOF', operators: ['TMONEY', 'MOOV'] },
  { code: 'ML', name: 'Mali', dial: '223', currency: 'XOF', operators: ['ORANGE', 'MOOV', 'MOBICASH'] },
  { code: 'CM', name: 'Cameroun', dial: '237', currency: 'XAF', operators: ['ORANGE', 'MTN'] },
  { code: 'CG', name: 'Congo-Brazzaville', dial: '242', currency: 'XAF', operators: ['MTN', 'AIRTEL'] },
  { code: 'GA', name: 'Gabon', dial: '241', currency: 'XAF', operators: ['AIRTEL', 'MOBICASH'] },
  { code: 'CD', name: 'RD Congo', dial: '243', currency: 'USD', operators: ['AIRTEL', 'ORANGE', 'VODACOM', 'MPESA'] },
  { code: 'NE', name: 'Niger', dial: '227', currency: 'XOF', operators: ['AIRTEL', 'MOOV', 'ORANGE'] },
];

export const OPERATOR_LABELS = {
  ORANGE: 'Orange Money',
  MTN: 'MTN Mobile Money',
  WAVE: 'Wave',
  MOOV: 'Moov Money',
  MOBICASH: 'Mobicash',
  AIRTEL: 'Airtel Money',
  VODACOM: 'Vodacom M-Pesa',
  MPESA: 'M-Pesa',
  FREE: 'Free Money',
  EMONEY: 'E-Money',
  TMONEY: 'Mixx / T-Money',
};

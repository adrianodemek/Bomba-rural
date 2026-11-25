// Passe do Minerador (Premium de 30 dias): só conforto, nenhum poder exclusivo.
// Em modo de teste a compra é liberada na hora; com o modo online, buyPass() passa a chamar o pagamento
// (Mercado Pago / Stripe / Google Play) e o servidor confirma antes de ativar.
import { BALANCE } from '../config/balance.js';
import { economy } from './Economy.js';
import { todayKey } from './Goals.js';

const P = () => BALANCE.premium;
const DAY = 86400000;

export function premiumActive(now = Date.now()) {
  return (economy.premium?.until || 0) > now;
}

export function premiumDaysLeft(now = Date.now()) {
  return premiumActive(now) ? Math.ceil((economy.premium.until - now) / DAY) : 0;
}

// Benefícios (0 quando o Passe não está ativo).
export const premiumOfflineHours = () => (premiumActive() ? P().offlineHours : 0);
export const premiumRecoveryBonus = () => (premiumActive() ? P().recoveryBonus : 0);
export const expeditionSlots = () => BALANCE.expeditions.slots + (premiumActive() ? P().expeditionSlots : 0);
export const canOpenAllChests = () => premiumActive();

// Compra (ou renova) o Passe: soma 30 dias ao que ainda falta.
export function buyPass() {
  if (!P().testMode) return false; // pagamento real ainda não ligado
  const now = Date.now();
  economy.premium.until = Math.max(now, economy.premium.until || 0) + P().days * DAY;
  economy.premium.bought = (economy.premium.bought || 0) + 1;
  economy.emit('premium');
  economy.emit('currency');
  return true;
}

// Cristais do dia: uma vez por dia enquanto o Passe estiver ativo.
export function premiumDailyAvailable() {
  return premiumActive() && economy.premium.lastDaily !== todayKey();
}

export function claimPremiumDaily() {
  if (!premiumDailyAvailable()) return 0;
  economy.premium.lastDaily = todayKey();
  economy.addCrystals(P().dailyCrystals);
  return P().dailyCrystals;
}

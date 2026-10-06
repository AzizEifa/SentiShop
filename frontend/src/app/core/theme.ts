// src/app/core/theme.ts — couleurs utilisées hors CSS (graphiques Chart.js)
// Doivent rester identiques aux variables --pos / --neu / --neg de styles.scss.

import { Chart, registerables } from 'chart.js';
import { Sentiment } from './models/models';

export const SENTIMENT_HEX: Record<Sentiment, string> = {
  POSITIVE: '#16a579',
  NEUTRAL: '#e9a23b',
  NEGATIVE: '#e65353',
};

/** Ordre positif / neutre / négatif, partout dans l'application. */
export const SENTIMENT_COLORS = [SENTIMENT_HEX.POSITIVE, SENTIMENT_HEX.NEUTRAL, SENTIMENT_HEX.NEGATIVE];

export const CHART_INK = { text: '#5e6c84', grid: '#edf1f7', navy: '#0f2747', primary: '#1677e8' };

/** Typographie et infobulles communes à tous les graphiques (appelé au démarrage). */
export function applyChartDefaults() {
  // les réglages du plugin tooltip n'existent qu'une fois les plugins enregistrés (ng2-charts le refait sans effet)
  Chart.register(...registerables);
  Chart.defaults.font.family = "'Inter Variable', Inter, system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = CHART_INK.text;
  Chart.defaults.borderColor = CHART_INK.grid;
  const tooltip = Chart.defaults.plugins.tooltip;
  tooltip.backgroundColor = CHART_INK.navy;
  tooltip.padding = 10;
  tooltip.cornerRadius = 8;
  tooltip.boxPadding = 4;
  tooltip.usePointStyle = true;
}

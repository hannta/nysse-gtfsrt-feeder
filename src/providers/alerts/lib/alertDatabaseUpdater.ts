import { insertOrUpdate, emptyTable } from '../../../lib/databaseUtils';
import { AlertDB, InformedEntityDB, TranslatedTextDB } from '../../../types';

const ALERTS_TABLE = 'alerts';
const ALERT_INFORMED_ENTITIES_TABLE = 'alert_informed_entities';
const ALERT_HEADER_TEXTS_TABLE = 'alert_header_texts';
const ALERT_DESCRIPTION_TEXTS_TABLE = 'alert_description_texts';
const ALERT_URLS_TABLE = 'alert_urls';

export async function updateAlertsDatabase(
  regionKey: string,
  alerts: AlertDB[],
  alertInformedEntities: InformedEntityDB[],
  alertHeaderTexts: TranslatedTextDB[],
  alertDescriptionTexts: TranslatedTextDB[],
  alertUrls: TranslatedTextDB[],
) {
  // TODO do this in one transaction

  const alertsTable = `${regionKey}_${ALERTS_TABLE}`;
  await emptyTable(alertsTable);
  await insertOrUpdate(alertsTable, alerts);

  const alertInformedEntitiesTable = `${regionKey}_${ALERT_INFORMED_ENTITIES_TABLE}`;
  await insertOrUpdate(alertInformedEntitiesTable, alertInformedEntities);

  const alertHeaderTextsTable = `${regionKey}_${ALERT_HEADER_TEXTS_TABLE}`;
  await insertOrUpdate(alertHeaderTextsTable, alertHeaderTexts);

  const alertDescriptionTextsTable = `${regionKey}_${ALERT_DESCRIPTION_TEXTS_TABLE}`;
  await insertOrUpdate(alertDescriptionTextsTable, alertDescriptionTexts);

  const alertUrlsTable = `${regionKey}_${ALERT_URLS_TABLE}`;
  await insertOrUpdate(alertUrlsTable, alertUrls);
}

export async function deleteAlerts(regionKey: string) {
  const alertsTable = `${regionKey}_${ALERTS_TABLE}`;
  return emptyTable(alertsTable);
}

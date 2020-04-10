import { knex } from '../../../config/database';
import { AlertDB, InformedEntityDB, TranslatedTextDB } from '../../../types';
import { insertOrUpdate } from '../../../lib/databaseUtils';

const ALERTS_TABLE = 'alerts';
const ALERT_INFORMED_ENTITIES_TABLE = 'alert_informed_entities';
const ALERT_HEADER_TEXTS_TABLE = 'alert_header_texts';
const ALERT_DESCRIPTION_TEXTS_TABLE = 'alert_description_texts';
const ALERT_URLS_TABLE = 'alert_urls';

export class AlertDatabaseUpdater {
  private readonly regionKey: string;

  constructor(regionKey: string) {
    this.regionKey = regionKey;
  }

  public async updateAlertsDatabase(
    alerts: AlertDB[],
    alertInformedEntities: InformedEntityDB[],
    alertHeaderTexts: TranslatedTextDB[],
    alertDescriptionTexts: TranslatedTextDB[],
    alertUrls: TranslatedTextDB[],
  ) {
    const alertsTable = `${this.regionKey}_${ALERTS_TABLE}`;
    const alertInformedEntitiesTable = `${this.regionKey}_${ALERT_INFORMED_ENTITIES_TABLE}`;
    const alertHeaderTextsTable = `${this.regionKey}_${ALERT_HEADER_TEXTS_TABLE}`;
    const alertDescriptionTextsTable = `${this.regionKey}_${ALERT_DESCRIPTION_TEXTS_TABLE}`;
    const alertUrlsTable = `${this.regionKey}_${ALERT_URLS_TABLE}`;

    return knex.transaction(async (trx) => {
      await trx(alertsTable).del();

      if (alerts.length > 0) {
        await insertOrUpdate(trx, alertsTable, alerts);
      }

      if (alertInformedEntities.length > 0) {
        await insertOrUpdate(trx, alertInformedEntitiesTable, alertInformedEntities);
      }

      if (alertHeaderTexts.length > 0) {
        await insertOrUpdate(trx, alertHeaderTextsTable, alertHeaderTexts);
      }

      if (alertDescriptionTexts.length > 0) {
        await insertOrUpdate(trx, alertDescriptionTextsTable, alertDescriptionTexts);
      }

      if (alertUrls.length > 0) {
        await insertOrUpdate(trx, alertUrlsTable, alertUrls);
      }
    });
  }

  public async deleteAlerts() {
    const alertsTable = `${this.regionKey}_${ALERTS_TABLE}`;
    return knex(alertsTable).del();
  }
}

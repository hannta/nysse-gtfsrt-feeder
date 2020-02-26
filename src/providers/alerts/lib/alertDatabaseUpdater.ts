import { knex } from '../../../config/database';
import { AlertDB, InformedEntityDB, TranslatedTextDB } from '../../../types';
import Knex from 'knex';

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

    return knex.transaction(async trx => {
      await trx(alertsTable).del();

      if (alerts.length > 0) {
        await this.insertOrUpdate(trx, alertsTable, alerts);
      }

      if (alertInformedEntities.length > 0) {
        await this.insertOrUpdate(trx, alertInformedEntitiesTable, alertInformedEntities);
      }

      if (alertHeaderTexts.length > 0) {
        await this.insertOrUpdate(trx, alertHeaderTextsTable, alertHeaderTexts);
      }

      if (alertDescriptionTexts.length > 0) {
        await this.insertOrUpdate(trx, alertDescriptionTextsTable, alertDescriptionTexts);
      }

      if (alertUrls.length > 0) {
        await this.insertOrUpdate(trx, alertUrlsTable, alertUrls);
      }
    });
  }

  public async deleteAlerts() {
    const alertsTable = `${this.regionKey}_${ALERTS_TABLE}`;
    return knex(alertsTable).del();
  }

  private async insertOrUpdate(
    knexTransaction: Knex.Transaction,
    tableName: string,
    data: object[],
  ) {
    const firstData = data[0] ? data[0] : data;
    return knexTransaction.raw(
      knexTransaction(tableName)
        .insert(data)
        .toQuery() +
        ' ON DUPLICATE KEY UPDATE ' +
        Object.getOwnPropertyNames(firstData)
          .map(field => `${field}=VALUES(${field})`)
          .join(', '),
    );
  }
}

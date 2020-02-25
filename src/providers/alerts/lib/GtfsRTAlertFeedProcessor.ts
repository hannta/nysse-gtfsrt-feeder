import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import winstonInstance from '../../../config/winston';
import {
  FeedMessage,
  AlertDB,
  InformedEntityDB,
  TranslatedTextDB,
  Translation,
  Cause,
  Effect,
} from '../../../types';
import { updateAlertsDatabase } from './alertDatabaseUpdater';

export class GtfsRTAlertFeedProcessor {
  private readonly regionKey: string;

  constructor(regionKey: string) {
    this.regionKey = regionKey;
  }

  public async storeAlertsUpdateFeed(feedBinary: any) {
    const feedData: FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      feedBinary,
    );

    if (!feedData || !feedData.entity) {
      throw new Error('No alert feed data');
    }

    const alertsDB: AlertDB[] = [];
    const alertInformedEntities: InformedEntityDB[] = [];
    const alertHeaderTexts: TranslatedTextDB[] = [];
    const alertDescriptionTexts: TranslatedTextDB[] = [];
    const alertUrls: TranslatedTextDB[] = [];

    for (const entity of feedData.entity) {
      const alert = entity.alert;

      if (!entity.id || !alert?.headerText || !alert.descriptionText) {
        winstonInstance.info('Empty service alert entity, skipping.', {
          regionKey: this.regionKey,
          entity,
        });
        continue;
      }

      const alertId = entity.id;

      alertsDB.push({
        id: alertId,
        start_time: alert.activePeriod?.[0].start.low,
        end_time: alert.activePeriod?.[0].end.low,
        cause: this.convertCause(alert.cause),
        effect: this.convertEffect(alert.effect),
      });

      alertInformedEntities.push(
        ...alert.informedEntity
          .filter(e => !(!e.agencyId && !e.routeId && !e.stopId && e.trip?.tripId))
          .map(informEntity => {
            return {
              alert_id: alertId,
              agency_id: informEntity.agencyId || undefined,
              route_id: informEntity.routeId || undefined,
              route_type: informEntity.routeType || undefined,
              stop_id: informEntity.stopId || undefined,
              trip_id: informEntity.trip?.tripId || undefined,
            };
          }),
      );

      alertHeaderTexts.push(
        ...alert.headerText.translation.map(translation =>
          this.convertTranslatedText(alertId, translation),
        ),
      );

      alertDescriptionTexts.push(
        ...alert.descriptionText.translation.map(translation =>
          this.convertTranslatedText(alertId, translation),
        ),
      );

      if (alert.url) {
        alertUrls.push(
          ...alert.url.translation.map(url => this.convertTranslatedText(alertId, url)),
        );
      }
    }

    await updateAlertsDatabase(
      this.regionKey,
      alertsDB,
      alertInformedEntities,
      alertHeaderTexts,
      alertDescriptionTexts,
      alertUrls,
    );

    return alertsDB.length;
  }

  private convertTranslatedText(alertId: string, translation: Translation): TranslatedTextDB {
    return {
      alert_id: alertId,
      translated_text: translation.text,
      language_code: translation.language || undefined,
    };
  }

  private convertCause(cause?: number): Cause {
    switch (cause) {
      case 1:
        return Cause.UNKNOWN_CAUSE;
      case 2:
        return Cause.OTHER_CAUSE;
      case 3:
        return Cause.TECHNICAL_PROBLEM;
      case 4:
        return Cause.STRIKE;
      case 5:
        return Cause.DEMONSTRATION;
      case 6:
        return Cause.ACCIDENT;
      case 7:
        return Cause.HOLIDAY;
      case 8:
        return Cause.WEATHER;
      case 9:
        return Cause.MAINTENANCE;
      case 10:
        return Cause.CONSTRUCTION;
      case 11:
        return Cause.POLICE_ACTIVITY;
      case 12:
        return Cause.MEDICAL_EMERGENCY;
      default:
        return Cause.UNKNOWN_CAUSE;
    }
  }

  private convertEffect(effect?: number): Effect {
    switch (effect) {
      case 1:
        return Effect.NO_SERVICE;
      case 2:
        return Effect.REDUCED_SERVICE;
      case 3:
        return Effect.SIGNIFICANT_DELAYS;
      case 4:
        return Effect.DETOUR;
      case 5:
        return Effect.ADDITIONAL_SERVICE;
      case 6:
        return Effect.MODIFIED_SERVICE;
      case 7:
        return Effect.OTHER_EFFECT;
      case 8:
        return Effect.UNKNOWN_EFFECT;
      case 9:
        return Effect.STOP_MOVED;
      default:
        return Effect.UNKNOWN_EFFECT;
    }
  }
}

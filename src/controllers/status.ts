import { Router, Request, Response, NextFunction } from 'express';
import { tripUpdateStatusDataMap } from '../providers/tripUpdates';
import { alertsStatusDataMap } from '../providers/alerts';

/**
 * Simple status controller for checking the data provider last status
 */
export class StatusController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.router.route('/').get(this.getStatus);
  }

  public async getStatus(req: Request, res: Response, next: NextFunction) {
    res.json({
      tripUpdates: Array.from(tripUpdateStatusDataMap.keys()).map(key => {
        return { [key]: tripUpdateStatusDataMap.get(key) };
      }),
      alerts: Array.from(alertsStatusDataMap.keys()).map(key => {
        return { [key]: tripUpdateStatusDataMap.get(key) };
      }),
    });
  }
}

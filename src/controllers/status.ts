import { Router, Request, Response, NextFunction } from 'express';
import { statusDataMap } from '../providers/tripUpdates';

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
      providers: Array.from(statusDataMap.keys()).map(key => {
        return { [key]: statusDataMap.get(key) };
      }),
    });
  }
}

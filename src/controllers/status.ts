import { Router, Request, Response, NextFunction } from 'express';
import { statusDataMap } from '../providers';

/**
 * Simple status controller
 */
export class StatusController {
  router: Router;

  constructor() {
    this.router = Router();
    this.router.route('/').get(this.getStatus);
  }

  public async getStatus(req: Request, res: Response, next: NextFunction) {
    res.json([...statusDataMap]); // Improve formatting!
  }
}

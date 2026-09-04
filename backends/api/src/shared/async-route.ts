import type { NextFunction, RequestHandler, Response } from "express";
import type { AuthRequest } from "../auth.js";

export const asyncRoute = (handler: (req: AuthRequest, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next: NextFunction) => handler(req, res).catch(next);

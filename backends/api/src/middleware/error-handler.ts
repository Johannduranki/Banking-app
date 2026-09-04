import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { logServerError } from "../shared/security-logger.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "Invalid request", issues:error.issues.map(issue=>({code:issue.code,path:issue.path,message:issue.message})) });
    return;
  }
  logServerError(req.id,error);
  res.status(error.status || 500).json({ message: error.status ? error.message : "Unexpected server error", requestId: req.id });
};

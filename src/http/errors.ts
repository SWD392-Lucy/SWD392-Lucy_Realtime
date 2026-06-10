import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "not_found", "Resource was not found."));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      code: "validation_error",
      message: "Request validation failed.",
      details: error.flatten()
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
      details: error.details
    });
  }

  console.error(error);
  return res.status(500).json({
    code: "internal_error",
    message: "Unexpected server error."
  });
}

/**
 * HTTP Parameter Pollution (HPP) - evita que atacantes injetem parâmetros duplicados
 */
import { Request, Response, NextFunction } from "express";

export function hppMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (Array.isArray(val)) {
        req.query[key] = val[val.length - 1] as string; // usa último valor
      }
    }
  }
  next();
}

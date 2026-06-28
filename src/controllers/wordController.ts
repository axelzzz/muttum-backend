import type { Request, Response, NextFunction } from 'express';
import * as wordService from '../services/wordService';

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await wordService.searchAndTrack(req.query.word as string, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await wordService.listUserWords(req.userId, req.query as Record<string, string>);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await wordService.getUserWord(req.userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await wordService.updateUserWord(req.userId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await wordService.deleteUserWord(req.userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

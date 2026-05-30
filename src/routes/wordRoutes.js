const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/wordController');

const router = express.Router();

router.use(auth);

router.get(
  '/search',
  [query('word').isString().trim().isLength({ min: 1, max: 100 })],
  validate,
  ctrl.search
);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
  ],
  validate,
  ctrl.list
);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid id')],
  validate,
  ctrl.getOne
);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('notes').optional().isString().isLength({ max: 2000 }),
    body('tags').optional().isArray(),
    body('favorite').optional().isBoolean(),
  ],
  validate,
  ctrl.update
);

router.delete(
  '/:id',
  [param('id').isMongoId()],
  validate,
  ctrl.remove
);

module.exports = router;

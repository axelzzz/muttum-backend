const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/wordController');

const router = express.Router();

router.use(auth);

/**
 * @openapi
 * /api/words/search:
 *   get:
 *     tags: [Words]
 *     summary: Search for a word and add it to the user's list
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: word
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         example: bonjour
 *     responses:
 *       200:
 *         description: Word found (with definitions and user metadata)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResult'
 *       404:
 *         description: Word not found in Wiktionary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       502:
 *         description: Wiktionary upstream error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/search',
  [query('word').isString().trim().isLength({ min: 1, max: 100 })],
  validate,
  ctrl.search
);

/**
 * @openapi
 * /api/words:
 *   get:
 *     tags: [Words]
 *     summary: List words in the user's dictionary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by word text
 *     responses:
 *       200:
 *         description: Paginated list of user words
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserWord'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
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

/**
 * @openapi
 * /api/words/{id}:
 *   get:
 *     tags: [Words]
 *     summary: Get a single user word by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UserWord document ID
 *     responses:
 *       200:
 *         description: UserWord document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserWord'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid id')],
  validate,
  ctrl.getOne
);

/**
 * @openapi
 * /api/words/{id}:
 *   patch:
 *     tags: [Words]
 *     summary: Update notes, tags, or favorite on a user word
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               favorite:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated UserWord
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserWord'
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/words/{id}:
 *   delete:
 *     tags: [Words]
 *     summary: Remove a word from the user's list
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  '/:id',
  [param('id').isMongoId()],
  validate,
  ctrl.remove
);

module.exports = router;

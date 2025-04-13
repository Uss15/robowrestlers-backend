const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const { auth } = require('../middleware/auth');

// Protected routes (require authentication)
router.post('/', auth, modelController.createModel);
router.get('/user', auth, modelController.getUserModels);
router.get('/public', auth, modelController.getPublicModels);
router.get('/favorites', auth, modelController.getFavoriteModels);
router.get('/search', auth, modelController.searchModels);
router.get('/:id', auth, modelController.getModelById);
router.put('/:id', auth, modelController.updateModel);
router.delete('/:id', auth, modelController.deleteModel);
router.post('/:id/rate', auth, modelController.rateModel);
router.post('/:id/download', auth, modelController.incrementDownloads);

module.exports = router;

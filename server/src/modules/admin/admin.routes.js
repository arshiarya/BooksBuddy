const express = require('express');
const adminController = require('./admin.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { requirePlatformAdmin } = require('../../middlewares/authorize');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

// All platform admin routes strictly require authentication and PLATFORM_ADMIN role
router.use(requireAuth, requirePlatformAdmin);

router.get('/stats', adminController.getStats);
router.get('/libraries', adminController.getAllLibraries);
router.patch('/libraries/:id/status', verifyCsrf, adminController.updateStatus);
router.delete('/libraries/:id', verifyCsrf, adminController.removeLibrary);

module.exports = router;

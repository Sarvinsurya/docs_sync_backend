const express = require('express');
const { 
  createDocument, 
  getDocuments, 
  getDocument, 
  updateDocument,
  deleteDocument,
  shareDocument,
  getSharedDocument,
  getDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public route for accessing a shared document (no auth required)
router.get('/shared/:token', getSharedDocument);
console.log("-----------called--------")
// Protect all other routes
router.use(protect);

// Document routes
router.route('/')
  .get(getDocuments)
  .post(createDocument);

router.route('/:id')
  .get(getDocument)
  .put(updateDocument)
  .delete(deleteDocument);

router.route('/:id/share')
  .post(shareDocument);

// Document version routes
router.route('/:id/versions')
  .get(getDocumentVersions);

router.route('/:id/versions/:versionNumber')
  .get(getDocumentVersion);

router.route('/:id/versions/:versionNumber/restore')
  .post(restoreDocumentVersion);

module.exports = router;

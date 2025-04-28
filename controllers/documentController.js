const Document = require('../models/Document');
const User = require('../models/User');

// @desc    Create a new document
// @route   POST /api/documents
// @access  Private
exports.createDocument = async (req, res) => {
  try {
    const { title } = req.body;
    console.log("-----------called creation--------")
    const document = await Document.create({
      title,
      content: '',
      owner: req.user.id
    });

    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all documents for a user
// @route   GET /api/documents
// @access  Private
exports.getDocuments = async (req, res) => {
  try {
    // Find documents owned by the user or shared with the user
    const documents = await Document.find({
      $or: [
        { owner: req.user.id },
        { 'sharedWith.userId': req.user.id }
      ]
    }).sort({ lastModified: -1 });

    res.json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get a single document
// @route   GET /api/documents/:id
// @access  Private
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user is the owner or has permission to access this document
    const isOwner = document.owner.toString() === req.user.id;
    const isSharedWithUser = document.sharedWith.some(
      share => share.userId.toString() === req.user.id
    );

    if (!isOwner && !isSharedWithUser) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this document'
      });
    }

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update a document
// @route   PUT /api/documents/:id
// @access  Private
exports.updateDocument = async (req, res) => {
  try {
    let document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user has permission to edit
    const isOwner = document.owner.toString() === req.user.id;
    const isSharedWithEditPermission = document.sharedWith.some(
      share => share.userId.toString() === req.user.id && share.permission === 'edit'
    );

    if (!isOwner && !isSharedWithEditPermission) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this document'
      });
    }

    // Update document
    const { title, content, createVersion, isRichText } = req.body;
    const significantChange = title !== document.title || 
                             (content && content.length !== document.content.length) ||
                             (isRichText !== undefined && isRichText !== document.isRichText);
    
    // Create a version if requested or if there's a significant change
    if (createVersion || significantChange) {
      document.createVersion(req.user.id);
    }
    
    // Update the document fields
    if (title) document.title = title;
    if (content !== undefined) document.content = content;
    if (isRichText !== undefined) document.isRichText = isRichText;
    document.lastModified = Date.now();
    
    // Save the updated document
    await document.save();

    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user is the owner
    if (document.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this document'
      });
    }

    // Use deleteOne instead of remove (which is deprecated)
    await Document.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Share a document with a user or generate a shareable link
// @route   POST /api/documents/:id/share
// @access  Private
exports.shareDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user is the owner
    if (document.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to share this document'
      });
    }

    const { email, permission, generateLink } = req.body;

    // Generate shareable link
    if (generateLink) {
      const token = document.generateShareableLink();
      await document.save();
      
      return res.json({
        success: true,
        shareableLink: `${req.protocol}://${req.get('host')}/api/documents/shared/${token}`
      });
    }

    // Share with a specific user
    if (email) {
      const userToShare = await User.findOne({ email });
      
      if (!userToShare) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if already shared with this user
      const alreadyShared = document.sharedWith.find(
        share => share.userId.toString() === userToShare._id.toString()
      );

      if (alreadyShared) {
        // Update permission if already shared
        alreadyShared.permission = permission || 'view';
      } else {
        // Add new share
        document.sharedWith.push({
          userId: userToShare._id,
          permission: permission || 'view'
        });
      }

      await document.save();

      return res.json({
        success: true,
        data: document
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Please provide an email or request a shareable link'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get a shared document via token
// @route   GET /api/documents/shared/:token
// @access  Public
exports.getSharedDocument = async (req, res) => {
  try {
    const { token } = req.params;
    
    const document = await Document.findOne({
      'shareableLink.token': token,
      'shareableLink.isActive': true
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired link'
      });
    }

    res.json({
      success: true,
      data: {
        id: document._id,
        title: document.title,
        content: document.content,
        isRichText: document.isRichText,
        lastModified: document.lastModified
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get document version history
// @route   GET /api/documents/:id/versions
// @access  Private
exports.getDocumentVersions = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user has permission to view
    const isOwner = document.owner.toString() === req.user.id;
    const isSharedWithUser = document.sharedWith.some(
      share => share.userId.toString() === req.user.id
    );

    if (!isOwner && !isSharedWithUser) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this document'
      });
    }

    // Return the versions in reverse chronological order (newest first)
    const versions = document.versions.sort((a, b) => b.versionNumber - a.versionNumber);

    res.json({
      success: true,
      currentVersion: document.currentVersion,
      data: versions.map(v => ({
        versionNumber: v.versionNumber,
        title: v.title,
        isRichText: v.isRichText,
        createdAt: v.createdAt,
        createdBy: v.createdBy
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get a specific document version
// @route   GET /api/documents/:id/versions/:versionNumber
// @access  Private
exports.getDocumentVersion = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user has permission to view
    const isOwner = document.owner.toString() === req.user.id;
    const isSharedWithUser = document.sharedWith.some(
      share => share.userId.toString() === req.user.id
    );

    if (!isOwner && !isSharedWithUser) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this document'
      });
    }

    const versionNumber = parseInt(req.params.versionNumber);
    const version = document.versions.find(v => v.versionNumber === versionNumber);

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Restore a specific document version
// @route   POST /api/documents/:id/versions/:versionNumber/restore
// @access  Private
exports.restoreDocumentVersion = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if the user has permission to edit
    const isOwner = document.owner.toString() === req.user.id;
    const isSharedWithEditPermission = document.sharedWith.some(
      share => share.userId.toString() === req.user.id && share.permission === 'edit'
    );

    if (!isOwner && !isSharedWithEditPermission) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this document'
      });
    }

    const versionNumber = parseInt(req.params.versionNumber);
    const version = document.versions.find(v => v.versionNumber === versionNumber);

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    // Create a version of the current state before restoring
    document.createVersion(req.user.id);
    
    // Restore the content, title, and isRichText from the old version
    document.content = version.content;
    document.title = version.title;
    document.isRichText = version.isRichText;
    document.lastModified = Date.now();
    
    await document.save();

    res.json({
      success: true,
      message: `Restored to version ${versionNumber}`,
      data: document
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

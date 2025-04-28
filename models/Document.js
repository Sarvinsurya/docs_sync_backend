const mongoose = require('mongoose');

// Version schema for document history
const VersionSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  isRichText: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  versionNumber: {
    type: Number,
    required: true
  }
});

const DocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a document title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  content: {
    type: String,
    default: ''
  },
  // Support for rich text formatting
  isRichText: {
    type: Boolean,
    default: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedWith: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permission: {
        type: String,
        enum: ['view', 'edit'],
        default: 'view'
      }
    }
  ],
  shareableLink: {
    token: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Document version history
  versions: [VersionSchema],
  // Current version number
  currentVersion: {
    type: Number,
    default: 1
  }
});

// Generate shareable link token
DocumentSchema.methods.generateShareableLink = function() {
  const token = Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
  
  this.shareableLink = {
    token,
    isActive: true
  };
  
  return token;
};

// Create a new version when document is significantly changed
DocumentSchema.methods.createVersion = function(userId) {
  // Add current state to versions array
  // Ensure content is never empty for validation
  const content = this.content || ' ';
  const title = this.title || 'Untitled';
  
  this.versions.push({
    content: content,
    title: title,
    isRichText: this.isRichText,
    createdBy: userId,
    versionNumber: this.currentVersion
  });
  
  // Increment version number
  this.currentVersion += 1;
};

// Index for faster queries
DocumentSchema.index({ owner: 1 });
DocumentSchema.index({ 'sharedWith.userId': 1 });
DocumentSchema.index({ 'shareableLink.token': 1 });

module.exports = mongoose.model('Document', DocumentSchema);

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const WebSocket = require('ws');
const { WebSocketServer } = require('ws');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const connectDB = require('./config/db');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes for API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Serve static files from public directory
// This will serve the Flutter web build if present
app.use(express.static(path.join(__dirname, 'public')));

// API routes should be processed before the catch-all route
// The static files middleware will handle regular file requests
// For any remaining routes, serve the index.html for client-side routing
app.get('*', (req, res) => {
  // Send the index.html for all non-file routes
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket server setup for real-time collaboration
const wss = new WebSocketServer({ server: server, path: '/ws' });

// Active collaborators by document
const activeCollaborators = new Map();

// Function to notify all users about active collaborators
const updateCollaborators = (documentId) => {
  const collaborators = activeCollaborators.get(documentId) || [];
  const message = JSON.stringify({
    action: 'collaborators_update',
    collaborators: collaborators
  });
  
  // Send to all clients for this document
  wss.clients.forEach((client) => {
    if (client.documentId === documentId && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Handle messages from clients
  ws.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data);
      const { action, documentId, content, userId, userName, cursorPosition, selection, 
              isRichText, richTextDelta, htmlContent } = parsedData;
      
      // Handle different types of actions
      switch (action) {
        case 'join':
          // Add client to a specific document room
          ws.documentId = documentId;
          ws.userId = userId;
          ws.userName = userName || 'Anonymous';
          
          // Add to active collaborators list
          if (!activeCollaborators.has(documentId)) {
            activeCollaborators.set(documentId, []);
          }
          
          const docCollaborators = activeCollaborators.get(documentId);
          const existingUserIndex = docCollaborators.findIndex(u => u.userId === userId);
          
          if (existingUserIndex >= 0) {
            docCollaborators[existingUserIndex] = { userId, userName: ws.userName };
          } else {
            docCollaborators.push({ userId, userName: ws.userName });
          }
          
          console.log(`User ${ws.userName} (${userId}) joined document ${documentId}`);
          updateCollaborators(documentId);
          break;
          

          
        case 'cursor_position':
          // Broadcast cursor position to all clients editing the same document
          if (cursorPosition !== undefined) {
            wss.clients.forEach((client) => {
              if (client !== ws && 
                  client.documentId === documentId && 
                  client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  action: 'cursor_position',
                  userId,
                  userName: ws.userName || 'Anonymous',
                  cursorPosition,
                  selection
                }));
              }
            });
          }
        break;
     case 'delta':
  console.log("called delta");

  if (documentId && parsedData.delta) {
    let delta = parsedData.delta;

    // ✅ Parse if delta is a JSON string
    if (typeof delta === 'string') {
      try {
        delta = JSON.parse(delta);
      } catch (e) {
        console.error("Invalid delta JSON:", e);
        return;
      }
    }

    // Broadcast to others
    console.log("Broadcasting delta to others");
    wss.clients.forEach((client) => {
      if (
        client !== ws &&
        client.documentId === documentId &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(JSON.stringify({
          action: 'delta_update',
          documentId,
          userId,
          delta, // ✅ always a parsed object/array
        }));
      }
    });
  }
  break;
        default:
          console.log('Unknown action:', action);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    
    if (ws.documentId && ws.userId) {
      // Remove user from active collaborators
      const docCollaborators = activeCollaborators.get(ws.documentId);
      if (docCollaborators) {
        const updatedCollaborators = docCollaborators.filter(u => u.userId !== ws.userId);
        
        if (updatedCollaborators.length > 0) {
          activeCollaborators.set(ws.documentId, updatedCollaborators);
        } else {
          activeCollaborators.delete(ws.documentId);
        }
        
        // Notify remaining users
        updateCollaborators(ws.documentId);
      }
    }
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle errors
process.on('unhandledRejection', (err) => {
  console.log('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

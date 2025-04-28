const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Remove deprecated options since they're no longer needed in newer MongoDB driver
    const conn = await mongoose.connect(
      process.env.MONGO_URI || 'mongodb+srv://sarvinsurya2704:PW1SXer4f0QKHBZl@docs-sync.ijtcepq.mongodb.net/?retryWrites=true&w=majority&appName=docs-sync'
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Setup connection error handler for runtime errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err.message}`);
    });
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Give more detailed error for common connection issues
    if (error.name === 'MongoNetworkError') {
      console.error('Network error connecting to MongoDB. Please check your connection and MongoDB service.');
    } else if (error.name === 'MongoServerSelectionError') {
      console.error('Could not select a MongoDB server. Please check that MongoDB is running.');
    }
    process.exit(1);
  }
};

module.exports = connectDB;

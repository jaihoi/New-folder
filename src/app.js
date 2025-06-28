// Primary Express server setup
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Routes
const chatbotRoutes = require('./routes/chatbot.routes');

// Configure Express
app.use(cors());
app.use(express.json());

// Mount our routes
app.use('/api', chatbotRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// chatbot.routes.js
// Defines Express routes corresponding to the Flask routes in the original chatbot_backend.py.
// Each route calls into the chatbot service to replicate the chatbot functionality.

const express = require('express');
const router = express.Router();
const chatbotService = require('../services/chatbot.service');

// POST /api/generate_question
// Generates a question (and an answer behind the scenes) for a given topic
router.post('/generate_question', async (req, res) => {
  try {
    const data = req.body || {};
    const topic = data.topic || 'financial literacy';

    const question = await chatbotService.generateQuestionWithAnswer(topic);
    return res.json({
      success: true,
      question
    });
  } catch (error) {
    console.error('Error generating question:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// POST /api/submit_answer
// Receives the user's answer, evaluates correctness, and returns a result
router.post('/submit_answer', async (req, res) => {
  try {
    const data = req.body || {};
    const userAnswer = data.answer || '';

    if (!userAnswer.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Answer cannot be empty'
      });
    }

    const evaluation = await chatbotService.evaluateAnswer(userAnswer);
    return res.json({
      success: true,
      evaluation
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// POST /api/ask_question
// Directly answers a user-provided question
router.post('/ask_question', async (req, res) => {
  try {
    const data = req.body || {};
    const question = data.question || '';

    const response = await chatbotService.handleGeneralQuestion(question);
    return res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error handling question:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// POST /api/reset_chat
// Resets the in-memory chat context
router.post('/reset_chat', async (req, res) => {
  try {
    chatbotService.resetChat();
    return res.json({
      success: true,
      message: 'Chat reset successfully'
    });
  } catch (error) {
    console.error('Error resetting chat:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

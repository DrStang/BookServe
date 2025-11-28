import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  Avatar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';

const AIChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    checkAIStatus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkAIStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/ai/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiAvailable(response.data.available);
    } catch (err) {
      setAiAvailable(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // Create context from previous messages
      const context = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await axios.post(
        '/api/ai/chat',
        { message: input, context },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // For now, get the full response (non-streaming fallback)
      // In production, you'd want to implement SSE streaming
      const aiMessage = { role: 'assistant', content: response.data.answer || 'No response received' };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!aiAvailable) {
    return (
      <Box p={3}>
        <Alert severity="info">
          AI chat is currently unavailable. Make sure Ollama is running and configured correctly.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0f0f0f'
      }}
    >
      {/* Chat Header */}
      <Paper sx={{ p: 2, bgcolor: '#1e1e1e', borderRadius: 0 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <BotIcon color="primary" />
          <Typography variant="h6">AI Book Assistant</Typography>
        </Box>
      </Paper>

      {/* Messages */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: '#1a1a1a'
        }}
      >
        {messages.length === 0 ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >
            <Typography variant="body1" color="text.secondary">
              Ask me anything about your books!
            </Typography>
          </Box>
        ) : (
          <List>
            {messages.map((message, index) => (
              <ListItem
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    maxWidth: '70%',
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: message.role === 'user' ? '#e50914' : '#2a2a2a'
                    }}
                  >
                    {message.role === 'user' ? <PersonIcon /> : <BotIcon />}
                  </Avatar>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: message.role === 'user' ? '#e50914' : '#2a2a2a',
                      color: 'white'
                    }}
                  >
                    <Typography variant="body1">{message.content}</Typography>
                  </Paper>
                </Box>
              </ListItem>
            ))}
            {loading && (
              <ListItem>
                <Box display="flex" gap={1} alignItems="center">
                  <Avatar sx={{ bgcolor: '#2a2a2a' }}>
                    <BotIcon />
                  </Avatar>
                  <CircularProgress size={20} />
                </Box>
              </ListItem>
            )}
            <div ref={messagesEndRef} />
          </List>
        )}
      </Box>

      {/* Input */}
      <Paper sx={{ p: 2, bgcolor: '#1e1e1e', borderRadius: 0 }}>
        <Box display="flex" gap={1}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            multiline
            maxRows={4}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default AIChat;

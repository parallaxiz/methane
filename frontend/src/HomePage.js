import React from 'react';
import { Box, Typography, Container, Paper } from '@mui/material';

function HomePage() {
  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ padding: '32px', textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom>
          Welcome to the Methane Mapper
        </Typography>
        <Typography variant="h6" color="textSecondary">
          Monitoring greenhouse gas emissions from around the globe.
        </Typography>
        <Typography variant="body1" sx={{ mt: 3 }}>
          This is the home page for the application. You can add more information, graphs, or introductory text here.
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          Click on the "Methane Map" tab in the top right to view the interactive emissions map.
        </Typography>
      </Paper>
    </Container>
  );
}

export default HomePage;

import React, { useState } from 'react';

// Import ThemeProvider and createTheme
import { Box, AppBar, Toolbar, Button, Typography, CssBaseline } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MethaneMapPage from './MethaneMapPage';
import HomePage from './HomePage';

// Create a custom theme with the Poppins font and a larger base size
const theme = createTheme({
  typography: {
    // Set the font family to Poppins
    fontFamily: '"Poppins", "Helvetica", "Arial", sans-serif',
    
    // Increase the base font size (default is 14)
    fontSize: 30  ,

    button: {
      textTransform: 'none' // Optional: Makes button text look cleaner
    }
  },
});

function App() {
  const [activePage, setActivePage] = useState('home');

  const renderPage = () => {
    switch (activePage) {
      case 'map':
        return <MethaneMapPage />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  return (
    // Wrap the entire app in the ThemeProvider to apply the theme
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <CssBaseline />
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Methane Mapper
            </Typography>
            <Button color="inherit" onClick={() => setActivePage('home')}>
              Home
            </Button>
            <Button color="inherit" onClick={() => setActivePage('map')}>
              Methane Map
            </Button>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {renderPage()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
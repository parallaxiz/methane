import React, { useState } from 'react';
import { Box, AppBar, Toolbar, Button, Typography, CssBaseline } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MethaneMapPage from './MethaneMapPage';
import HomePage from './HomePage';

// Create a custom theme to set default component sizes
const theme = createTheme({
  typography: {
    fontFamily: '"Poppins", "Helvetica", "Arial", sans-serif',
    fontSize: 24,
    h6: {
      fontSize: '1.75rem',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    }
  },
  // NEW: Add a components section to set default props and styles
  components: {
    MuiButton: {
      defaultProps: {
        size: 'large', // Make all buttons larger by default
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium', // Set the default for text fields (used by DatePicker)
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'large', // Set the default for dropdowns
      },
    },
    MuiSlider: {
      styleOverrides: {
        // Increase the size of the slider
        root: {
          height: 10,
        },
        thumb: {
          height: 24,
          width: 24,
        },
        track: {
          height: 8,
        },
        rail: {
          height: 8,
        },
      },
    },
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
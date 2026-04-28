# Insighta Labs+ Web Portal

A modern web interface for the Insighta Labs+ Profile Intelligence System.

## Features

- 🔐 Secure GitHub OAuth authentication
- 👤 Role-based access control (Admin & Analyst)
- 🔍 Advanced profile search and filtering
- 📊 Real-time data pagination
- 📥 CSV export functionality
- 🎨 Responsive design
- 🛡️ CSRF protection

## Quick Start

### Prerequisites

- Node.js 20+
- Running Insighta backend API

### Local Development

```bash
# Clone the repository
git clone <web-portal-repo-url>
cd insighta-web-portal

# Update BACKEND_URL in app.js
# Update the GITHUB_CLIENT_ID in the backend

# Serve locally
python -m http.server 8000
# or
npx http-server
```

Visit `http://localhost:8000` in your browser.

### Configuration

Update the `BACKEND_URL` variable in `app.js`:

```javascript
const BACKEND_URL = "https://your-backend-url";
```

## Usage

### Authentication

1. Click "Sign in with GitHub"
2. Authorize the application
3. Credentials are stored securely in browser localStorage
4. Access token expires in 15 minutes

### Profile Management

- **Search**: Filter profiles by name, gender, age group, country
- **Pagination**: Navigate through large result sets
- **Export**: Download profiles as CSV (Admin & Analyst)
- **View Details**: Click on any profile for more information

### Admin Features

- ✓ Create new profiles
- ✓ Delete profiles
- ✓ Access all user management functions

### Analyst Features

- ✓ View profiles
- ✓ Search and filter
- ✓ Export data

## Architecture

### OAuth Flow

1. **Initiation**: User clicks "Sign in with GitHub"
2. **Authorization**: Redirected to GitHub for approval
3. **Callback**: Returns with authorization code
4. **Token Exchange**: Backend exchanges code for tokens
5. **Session**: Access token stored securely

### Token Management

- **Access Token**: 15-minute expiry (sent in Authorization header)
- **Refresh Token**: 7-day expiry (stored as httpOnly cookie)
- **Auto-Refresh**: Handled by backend on token expiration

### Security

- ✅ HttpOnly cookies (prevent XSS)
- ✅ CSRF protection via state parameter
- ✅ Secure token transmission
- ✅ Role-based endpoint access
- ✅ CORS restrictions

## Deployment

### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables

```
VITE_BACKEND_URL=https://your-backend-url
```

### Custom Domain

1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Update GitHub OAuth redirect URIs

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers supported

## Troubleshooting

### "OAuth state mismatch"

- Clear browser localStorage: `localStorage.clear()`
- Try logging in again

### "Token expired"

- Session has expired after 15 minutes
- Log in again to refresh

### CORS errors

- Ensure backend CORS is configured correctly
- Check `WEB_PORTAL_URL` in backend .env

## File Structure

```
insighta-web-portal/
├── index.html          # Main HTML file
├── app.js              # Application logic
├── style.css           # Styling
├── README.md           # This file
└── vercel.json         # Deployment config
```

## Support

For issues or questions, contact the development team or check the main repository documentation.

## License

MIT

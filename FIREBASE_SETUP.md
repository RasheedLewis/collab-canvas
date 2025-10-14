# Firebase Setup Guide

## Prerequisites
- Node.js and npm installed
- Firebase CLI installed: `npm install -g firebase-tools`

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `collab-canvas` (or your preferred name)
4. Enable Google Analytics (optional)
5. Wait for project creation

## Step 2: Enable Authentication

1. In Firebase Console, go to "Authentication" → "Get started"
2. Go to "Sign-in method" tab
3. Enable **Email/Password** provider
4. Enable **Google** provider:
   - Add your project's authorized domains (localhost:5173 for development)
   - Configure OAuth consent screen

## Step 3: Setup Firestore Database

1. Go to "Firestore Database" → "Create database"
2. Start in **test mode** for development
3. Choose a location close to your users

## Step 4: Get Configuration Credentials

### Frontend Configuration
1. **Copy the environment template:**
   ```bash
   cd frontend
   cp env.example .env
   ```
2. Go to Project Settings (gear icon) in Firebase Console
3. In "Your apps" section, click "Web app" (`</>`)
4. Register app with name "collab-canvas-frontend"
5. **Edit `frontend/.env`** and replace the placeholder values with your actual config:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-actual-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
VITE_FIREBASE_APP_ID=your_actual_app_id_here
```

### Backend Configuration (Service Account)
1. **Copy the environment template:**
   ```bash
   cd backend
   cp env.example .env
   ```
2. Go to Project Settings → "Service accounts" in Firebase Console
3. Click "Generate new private key"
4. Download the JSON file
5. **Edit `backend/.env`** and replace the placeholder values with your actual credentials:

```env
FIREBASE_PROJECT_ID=your-actual-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_CONTENT\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## Step 5: Configure Firestore Security Rules

Replace the default rules in Firestore with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Canvas objects - authenticated users only
    match /canvases/{canvasId} {
      allow read, write: if request.auth != null;
      
      match /objects/{objectId} {
        allow read, write: if request.auth != null;
      }
      
      match /sessions/{sessionId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## Step 6: Development Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## Step 7: Test Authentication

1. Start both frontend and backend
2. Open http://localhost:5173
3. Test Google OAuth sign-in
4. Test Email/Password sign-up
5. Verify user profiles are created in Firestore

## Troubleshooting

### Common Issues:
- **"Firebase app not initialized"**: Check your environment variables
- **"Auth domain not authorized"**: Add localhost:5173 to authorized domains
- **"Private key invalid"**: Ensure the private key includes newlines (`\n`)
- **"Permission denied"**: Check Firestore security rules

### Development Tips:
- Use Firebase Emulator Suite for local development:
  ```bash
  firebase emulators:start --only auth,firestore
  ```
- Set `VITE_USE_FIREBASE_PRODUCTION=false` to use emulators

## Production Deployment

1. Update authorized domains in Firebase Console
2. Set production environment variables
3. Update Firestore security rules for production
4. Enable monitoring and logging

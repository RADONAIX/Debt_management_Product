export const msalConfig = {
    auth: {
      clientId: '1ce4507c-b7a3-40d4-979e-fd52ef6359a2',
      authority: 'https://login.microsoftonline.com/b8a3753c-1887-4e8c-bc5e-31f5874d26c0',
      redirectUri: '/',
    },
    cache: {
      cacheLocation: 'Sessionstorage',
      storeAuthStateInCookie: true,
    },
  };
  
  
  
  export const loginRequest = {
    scopes: ["user.read"], // Add any additional scopes required by your application
  };
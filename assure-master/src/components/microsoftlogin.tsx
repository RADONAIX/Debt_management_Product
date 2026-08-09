import React from 'react';
import {
  PublicClientApplication,
  AccountInfo,
  AuthenticationResult
} from '@azure/msal-browser';

type MicrosoftAppProps = {
  clientId: string;
  prompt?: string;
  children: (login: () => void) => React.ReactNode; // render prop
};

type MicrosoftAppState = {
  error: Error | null;
  isAuthenticated: boolean;
  user: AccountInfo | null;
};

class MicrosoftApp extends React.Component<MicrosoftAppProps, MicrosoftAppState> {
  private publicClientApplication: PublicClientApplication;

  constructor(props: MicrosoftAppProps) {
    super(props);
    this.state = {
      error: null,
      isAuthenticated: false,
      user: null
    };

    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);

    this.publicClientApplication = new PublicClientApplication({
      auth: {
        clientId: props.clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin
      },
      cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: true
      }
    });
  }

  async login() {
    try {
      const response: AuthenticationResult = await this.publicClientApplication.loginPopup({
        scopes: ['user.read'],
        prompt: this.props.prompt || 'select_account'
      });

      this.setState({
        isAuthenticated: true,
        user: response.account || null,
        error: null
      });
    } catch (err) {
      this.setState({
        isAuthenticated: false,
        user: null,
        error: err as Error
      });
    }
  }

  logout() {
    this.publicClientApplication.logoutRedirect();
  }

  render() {
    return (
      <>
        {this.props.children(this.login)}
        {/* {this.state.error && (
          <p style={{ color: 'red' }}>{this.state.error.message}</p>
        )} */}
      </>
    );
  }
}

export default MicrosoftApp;

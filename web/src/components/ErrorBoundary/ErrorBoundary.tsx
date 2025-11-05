import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorScreen } from '../ErrorScreen/ErrorScreen';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // エラーが発生したら状態を更新
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーログを出力
    console.error('Uncaught error:', error, errorInfo);

    // 本番環境では、エラーログを外部サービスに送信することも検討
    // 例: Sentry, Datadog, etc.
  }

  public resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      console.log('[ErrorBoundary] Rendering ErrorScreen', {
        hasError: this.state.hasError,
        error: this.state.error?.message
      });
      return <ErrorScreen error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

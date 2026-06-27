import { Component, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
}

interface SceneErrorBoundaryState {
  error: Error | null;
}

export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  constructor(props: SceneErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Scene load error:', error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="scene-error"
          role="alert"
          aria-live="assertive"
          data-testid="scene-error"
        >
          <p className="scene-error-title">3D 场景加载失败</p>
          <p className="scene-error-detail">
            {this.state.error.message || '未知错误'}
          </p>
          <button
            className="scene-error-retry"
            type="button"
            onClick={this.handleRetry}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
